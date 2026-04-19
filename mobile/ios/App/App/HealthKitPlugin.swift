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

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let start = formatter.date(from: startIso) ?? ISO8601DateFormatter().date(from: startIso)
        let end = formatter.date(from: endIso) ?? ISO8601DateFormatter().date(from: endIso)

        guard let startDate = start, let endDate = end, endDate > startDate else {
            call.reject("Invalid startDate/endDate")
            return
        }

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
}
