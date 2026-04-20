import Capacitor
import HealthKit
import os.log

@objc(HealthKitPlugin)
public class HealthKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthKitPlugin"
    public let jsName = "HealthKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveWorkout", returnType: CAPPluginReturnPromise),
    ]

    private let logger = Logger(subsystem: "com.boardsesh.app", category: "HealthKitPlugin")
    private let healthStore = HKHealthStore()

    // Static date formatters — allocated once, reused across calls.
    private static let isoWithFrac: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let isoPlain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    private static let fallbackFormats = [
        "yyyy-MM-dd'T'HH:mm:ss.SSSZ",
        "yyyy-MM-dd'T'HH:mm:ssZ",
        "yyyy-MM-dd HH:mm:ss.SSS",
        "yyyy-MM-dd HH:mm:ss",
    ]

    // MARK: - isAvailable

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }

    // MARK: - requestAuthorization

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["granted": false])
            return
        }
        let types: Set<HKSampleType> = [HKObjectType.workoutType()]
        healthStore.requestAuthorization(toShare: types, read: nil) { [weak self] success, error in
            if let error = error {
                self?.logger.error("HealthKit auth error: \(error.localizedDescription, privacy: .public)")
                call.resolve(["granted": false])
                return
            }
            let status = self?.healthStore.authorizationStatus(for: HKObjectType.workoutType())
            let granted = success && status == .sharingAuthorized
            if !granted {
                self?.logger.warning("HealthKit auth not granted. success=\(success), status=\(String(describing: status?.rawValue))")
            }
            call.resolve(["granted": granted])
        }
    }

    // MARK: - saveWorkout

    @objc func saveWorkout(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("HealthKit is not available on this device")
            return
        }

        guard let sessionId = call.getString("sessionId"),
              let startIso = call.getString("startDate"),
              let endIso = call.getString("endDate") else {
            call.reject("Missing required parameter: sessionId, startDate, or endDate")
            return
        }

        guard let startDate = parseISO8601(startIso), let endDate = parseISO8601(endIso), endDate > startDate else {
            let parsedStart = parseISO8601(startIso)
            let parsedEnd = parseISO8601(endIso)
            logger.error("Invalid dates: startDate=\(startIso, privacy: .public) endDate=\(endIso, privacy: .public) parsedStart=\(String(describing: parsedStart), privacy: .public) parsedEnd=\(String(describing: parsedEnd), privacy: .public)")
            call.reject("Invalid startDate/endDate: start=\(startIso), end=\(endIso)")
            return
        }

        let durationSeconds = endDate.timeIntervalSince(startDate)
        logger.info("Workout dates: start=\(startIso, privacy: .public) end=\(endIso, privacy: .public) duration=\(Int(durationSeconds))s")

        let totalSends = call.getInt("totalSends") ?? 0
        let totalAttempts = call.getInt("totalAttempts") ?? 0
        let hardestGrade = call.getString("hardestGrade")
        let boardType = call.getString("boardType") ?? ""

        var metadata: [String: Any] = [
            HKMetadataKeyExternalUUID: sessionId,
            "BoardseshSessionId": sessionId,
            "BoardseshTotalSends": totalSends,
            "BoardseshTotalAttempts": totalAttempts,
            "BoardseshBoardType": boardType,
        ]
        if let hardestGrade = hardestGrade, !hardestGrade.isEmpty {
            metadata["BoardseshHardestGrade"] = hardestGrade
        }

        let workout = HKWorkout(
            activityType: .climbing,
            start: startDate,
            end: endDate,
            duration: endDate.timeIntervalSince(startDate),
            totalEnergyBurned: nil,
            totalDistance: nil,
            metadata: metadata
        )

        healthStore.save(workout) { [weak self] success, error in
            if let error = error {
                self?.logger.error("Failed to save workout: \(error.localizedDescription, privacy: .public)")
                call.reject("Failed to save workout: \(error.localizedDescription)")
                return
            }
            if !success {
                call.reject("Failed to save workout")
                return
            }
            self?.logger.info("Saved climbing workout for session \(sessionId, privacy: .public)")
            call.resolve(["workoutId": workout.uuid.uuidString])
        }
    }

    // MARK: - Helpers

    private func parseISO8601(_ string: String) -> Date? {
        if let date = Self.isoWithFrac.date(from: string) { return date }
        if let date = Self.isoPlain.date(from: string) { return date }

        // Fallback: try common non-ISO formats (e.g. SQL timestamp).
        // Allocate per call — DateFormatter is not thread-safe.
        let df = DateFormatter()
        df.locale = Locale(identifier: "en_US_POSIX")
        df.timeZone = TimeZone(secondsFromGMT: 0)
        for fmt in Self.fallbackFormats {
            df.dateFormat = fmt
            if let date = df.date(from: string) { return date }
        }

        return nil
    }
}
