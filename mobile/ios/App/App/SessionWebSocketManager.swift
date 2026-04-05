import Foundation

// MARK: - graphql-ws Protocol Messages

enum GQLMessageType: String {
    case connectionInit = "connection_init"
    case connectionAck = "connection_ack"
    case subscribe = "subscribe"
    case next = "next"
    case error = "error"
    case complete = "complete"
    case ping = "ping"
    case pong = "pong"
}

// MARK: - Parsed Protocol Message

struct GQLMessage {
    let type: GQLMessageType
    let id: String?
    let payload: [String: Any]?

    static func parse(_ text: String) -> GQLMessage? {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let typeStr = json["type"] as? String,
              let type = GQLMessageType(rawValue: typeStr)
        else {
            return nil
        }
        let id = json["id"] as? String
        let payload = json["payload"] as? [String: Any]
        return GQLMessage(type: type, id: id, payload: payload)
    }
}

// MARK: - Queue Update Events

enum QueueUpdateEvent {
    case fullSync(items: [SharedQueueItem], currentItem: SharedQueueItem?, sequence: Int)
    case currentClimbChanged(item: SharedQueueItem?, sequence: Int)
    case itemAdded(item: SharedQueueItem, position: Int, sequence: Int)
    case itemRemoved(uuid: String, sequence: Int)
    case reordered(uuid: String, oldIndex: Int, newIndex: Int, sequence: Int)
    case climbMirrored(mirrored: Bool, sequence: Int)
}

// MARK: - Message Parsing Helpers

enum QueueMessageParser {

    /// Extract the `queueUpdates` dictionary from a graphql-ws `next` payload.
    static func extractQueueUpdates(from payload: [String: Any]?) -> [String: Any]? {
        guard let data = payload?["data"] as? [String: Any],
              let updates = data["queueUpdates"] as? [String: Any]
        else {
            return nil
        }
        return updates
    }

    /// Convert a raw climb+queue-item dictionary into a `SharedQueueItem`.
    static func parseQueueItem(_ dict: [String: Any]?) -> SharedQueueItem? {
        guard let dict = dict,
              let uuid = dict["uuid"] as? String,
              let climb = dict["climb"] as? [String: Any],
              let climbUuid = climb["uuid"] as? String
        else {
            return nil
        }

        let name = climb["name"] as? String ?? ""
        let difficulty = Self.parseDifficulty(climb["difficulty"])
        let angle = Self.parseIntValue(climb["angle"]) ?? 0
        let frames = climb["frames"] as? String ?? ""
        let setter = climb["setter_username"] as? String ?? ""

        return SharedQueueItem(
            uuid: uuid,
            climbUuid: climbUuid,
            climbName: name,
            difficulty: difficulty,
            angle: angle,
            frames: frames,
            setterUsername: setter
        )
    }

    /// Parse a FullSync event from the queueUpdates dictionary.
    static func parseFullSync(_ updates: [String: Any]) -> QueueUpdateEvent? {
        guard let state = updates["state"] as? [String: Any] else { return nil }
        let sequence = Self.parseIntValue(updates["sequence"]) ?? 0

        let queueArray = state["queue"] as? [[String: Any]] ?? []
        let items = queueArray.compactMap { parseQueueItem($0) }

        let currentItem = parseQueueItem(state["currentClimbQueueItem"] as? [String: Any])

        return .fullSync(items: items, currentItem: currentItem, sequence: sequence)
    }

    /// Parse a CurrentClimbChanged event.
    static func parseCurrentClimbChanged(_ updates: [String: Any]) -> QueueUpdateEvent? {
        let sequence = Self.parseIntValue(updates["sequence"]) ?? 0
        let item = parseQueueItem(updates["currentItem"] as? [String: Any])
        return .currentClimbChanged(item: item, sequence: sequence)
    }

    /// Parse a QueueItemAdded event.
    static func parseQueueItemAdded(_ updates: [String: Any]) -> QueueUpdateEvent? {
        let sequence = Self.parseIntValue(updates["sequence"]) ?? 0
        let position = Self.parseIntValue(updates["position"]) ?? 0
        let item = parseQueueItem(updates["addedItem"] as? [String: Any])
        guard let item = item else { return nil }
        return .itemAdded(item: item, position: position, sequence: sequence)
    }

    /// Parse a QueueItemRemoved event.
    static func parseQueueItemRemoved(_ updates: [String: Any]) -> QueueUpdateEvent? {
        guard let uuid = updates["uuid"] as? String else { return nil }
        let sequence = Self.parseIntValue(updates["sequence"]) ?? 0
        return .itemRemoved(uuid: uuid, sequence: sequence)
    }

    /// Parse a QueueReordered event.
    static func parseQueueReordered(_ updates: [String: Any]) -> QueueUpdateEvent? {
        guard let uuid = updates["uuid"] as? String else { return nil }
        let sequence = Self.parseIntValue(updates["sequence"]) ?? 0
        let oldIndex = Self.parseIntValue(updates["oldIndex"]) ?? 0
        let newIndex = Self.parseIntValue(updates["newIndex"]) ?? 0
        return .reordered(uuid: uuid, oldIndex: oldIndex, newIndex: newIndex, sequence: sequence)
    }

    /// Parse a ClimbMirrored event.
    static func parseClimbMirrored(_ updates: [String: Any]) -> QueueUpdateEvent? {
        let sequence = Self.parseIntValue(updates["sequence"]) ?? 0
        let mirrored = updates["mirrored"] as? Bool ?? false
        return .climbMirrored(mirrored: mirrored, sequence: sequence)
    }

    /// Route the queueUpdates dictionary to the correct parser based on __typename.
    static func parseQueueUpdate(_ updates: [String: Any]) -> QueueUpdateEvent? {
        guard let typename = updates["__typename"] as? String else { return nil }
        switch typename {
        case "FullSync":
            return parseFullSync(updates)
        case "CurrentClimbChanged":
            return parseCurrentClimbChanged(updates)
        case "QueueItemAdded":
            return parseQueueItemAdded(updates)
        case "QueueItemRemoved":
            return parseQueueItemRemoved(updates)
        case "QueueReordered":
            return parseQueueReordered(updates)
        case "ClimbMirrored":
            return parseClimbMirrored(updates)
        default:
            return nil
        }
    }

    /// Detect a sequence gap: returns true when `received` is more than one
    /// step ahead of `lastKnown`. A value of -1 for `lastKnown` means no
    /// previous sequence has been recorded (first message).
    static func hasSequenceGap(lastKnown: Int, received: Int) -> Bool {
        guard lastKnown >= 0 else { return false }
        return received > lastKnown + 1
    }

    // MARK: - Private Helpers

    static func parseDifficulty(_ value: Any?) -> String {
        if let str = value as? String { return str }
        if let num = value as? Double { return String(format: "%.1f", num) }
        if let num = value as? Int { return String(num) }
        return ""
    }

    static func parseIntValue(_ value: Any?) -> Int? {
        if let i = value as? Int { return i }
        if let d = value as? Double { return Int(d) }
        if let s = value as? String { return Int(s) }
        return nil
    }
}

// MARK: - Session WebSocket Manager

final class SessionWebSocketManager {

    static let shared = SessionWebSocketManager()

    // MARK: - Callback

    /// Called whenever the queue state changes. Provides the full item list and
    /// the index of the current climb.
    var onQueueStateChanged: ((_ items: [SharedQueueItem], _ currentIndex: Int) -> Void)?

    // MARK: - Configuration

    private(set) var sessionId: String?
    private(set) var serverUrl: String?
    private(set) var authToken: String?

    // MARK: - Connection State

    private var urlSession: URLSession
    private var webSocketTask: URLSessionWebSocketTask?
    private var isConnected = false
    private var subscriptionId: String = "1"
    private var lastSequence: Int = -1

    // MARK: - Reconnection

    private var reconnectAttempt: Int = 0
    private var reconnectWorkItem: DispatchWorkItem?
    private let maxBackoff: TimeInterval = 30
    private var intentionalDisconnect = false

    // MARK: - Queue State

    private var queueItems: [SharedQueueItem] = []
    private var currentIndex: Int = 0

    // MARK: - Darwin Notification

    private var observingDarwinNotification = false

    // MARK: - Init

    init(urlSession: URLSession = .shared) {
        self.urlSession = urlSession
    }

    // MARK: - Public API

    func connect(serverUrl: String, sessionId: String, authToken: String? = nil) {
        self.serverUrl = serverUrl
        self.sessionId = sessionId
        self.authToken = authToken
        self.intentionalDisconnect = false
        self.lastSequence = -1
        startDarwinObservation()
        openConnection()
    }

    func disconnect() {
        intentionalDisconnect = true
        reconnectWorkItem?.cancel()
        reconnectWorkItem = nil
        stopDarwinObservation()
        sendComplete()
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        isConnected = false
    }

    // MARK: - Connection Lifecycle

    private func openConnection() {
        guard let serverUrl = serverUrl else { return }

        let wsScheme = serverUrl.hasPrefix("https") ? "wss" : "ws"
        let host = serverUrl
            .replacingOccurrences(of: "https://", with: "")
            .replacingOccurrences(of: "http://", with: "")
        let urlString = "\(wsScheme)://\(host)/graphql"

        guard let url = URL(string: urlString) else {
            print("[SessionWS] Failed to construct URL from: \(urlString)")
            return
        }

        var request = URLRequest(url: url)
        request.addValue("graphql-transport-ws", forHTTPHeaderField: "Sec-WebSocket-Protocol")

        webSocketTask = urlSession.webSocketTask(with: request)
        webSocketTask?.resume()
        sendConnectionInit()
        listenForMessages()
    }

    // MARK: - graphql-ws Protocol Messages

    private func sendConnectionInit() {
        var payload: [String: Any] = [:]
        if let token = authToken {
            payload["authToken"] = token
        }
        let message: [String: Any] = [
            "type": GQLMessageType.connectionInit.rawValue,
            "payload": payload
        ]
        sendJSON(message)
    }

    private func sendSubscription() {
        guard let sessionId = sessionId else { return }

        let query = """
        subscription QueueUpdates($sessionId: ID!) {
          queueUpdates(sessionId: $sessionId) {
            __typename
            ... on FullSync {
              sequence
              state {
                sequence
                stateHash
                queue {
                  uuid
                  climb { uuid setter_username name frames angle ascensionist_count difficulty quality_average stars difficulty_error mirrored benchmark_difficulty }
                  addedBy
                  suggested
                }
                currentClimbQueueItem {
                  uuid
                  climb { uuid setter_username name frames angle ascensionist_count difficulty quality_average stars difficulty_error mirrored benchmark_difficulty }
                  addedBy
                  suggested
                }
              }
            }
            ... on CurrentClimbChanged {
              sequence
              currentItem: item {
                uuid
                climb { uuid setter_username name frames angle difficulty }
                addedBy
                suggested
              }
              clientId
              correlationId
            }
            ... on QueueItemAdded {
              sequence
              addedItem: item {
                uuid
                climb { uuid setter_username name frames angle difficulty }
                addedBy
                suggested
              }
              position
            }
            ... on QueueItemRemoved {
              sequence
              uuid
            }
            ... on QueueReordered {
              sequence
              uuid
              oldIndex
              newIndex
            }
            ... on ClimbMirrored {
              sequence
              mirrored
            }
          }
        }
        """

        let message: [String: Any] = [
            "type": GQLMessageType.subscribe.rawValue,
            "id": subscriptionId,
            "payload": [
                "query": query,
                "variables": ["sessionId": sessionId]
            ]
        ]
        sendJSON(message)
    }

    private func sendComplete() {
        let message: [String: Any] = [
            "type": GQLMessageType.complete.rawValue,
            "id": subscriptionId
        ]
        sendJSON(message)
    }

    private func sendPong() {
        sendJSON(["type": GQLMessageType.pong.rawValue])
    }

    private func sendSetCurrentClimb(item: SharedQueueItem) {
        let correlationId = UUID().uuidString

        let query = """
        mutation SetCurrentClimb($item: ClimbQueueItemInput, $correlationId: ID) {
          setCurrentClimb(item: $item, correlationId: $correlationId) {
            uuid
            climb { uuid name difficulty }
          }
        }
        """

        let mutationId = "mutation-\(correlationId)"

        let climbInput: [String: Any] = [
            "uuid": item.climbUuid,
            "name": item.climbName,
            "frames": item.frames,
            "angle": item.angle,
            "difficulty": item.difficulty,
            "setter_username": item.setterUsername
        ]

        let itemInput: [String: Any] = [
            "uuid": item.uuid,
            "climb": climbInput,
            "addedBy": "",
            "suggested": false
        ]

        let message: [String: Any] = [
            "type": GQLMessageType.subscribe.rawValue,
            "id": mutationId,
            "payload": [
                "query": query,
                "variables": [
                    "item": itemInput,
                    "correlationId": correlationId
                ] as [String: Any]
            ] as [String: Any]
        ]
        sendJSON(message)
    }

    // MARK: - Message Handling

    private func listenForMessages() {
        webSocketTask?.receive { [weak self] result in
            guard let self = self else { return }
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self.handleMessage(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        self.handleMessage(text)
                    }
                @unknown default:
                    break
                }
                // Continue listening
                self.listenForMessages()

            case .failure:
                self.handleDisconnect()
            }
        }
    }

    private func handleMessage(_ text: String) {
        guard let msg = GQLMessage.parse(text) else { return }

        switch msg.type {
        case .connectionAck:
            isConnected = true
            reconnectAttempt = 0
            sendSubscription()

        case .ping:
            sendPong()

        case .next:
            handleNextMessage(msg)

        case .error:
            break

        case .complete:
            break

        default:
            break
        }
    }

    private func handleNextMessage(_ msg: GQLMessage) {
        guard let updates = QueueMessageParser.extractQueueUpdates(from: msg.payload) else { return }
        guard let event = QueueMessageParser.parseQueueUpdate(updates) else { return }

        let receivedSeq = sequenceFromEvent(event)
        if QueueMessageParser.hasSequenceGap(lastKnown: lastSequence, received: receivedSeq) {
            // Gap detected; the server will send a FullSync on reconnect. For now
            // we still process this message but note the gap.
        }
        lastSequence = receivedSeq

        applyEvent(event)
    }

    private func sequenceFromEvent(_ event: QueueUpdateEvent) -> Int {
        switch event {
        case .fullSync(_, _, let seq): return seq
        case .currentClimbChanged(_, let seq): return seq
        case .itemAdded(_, _, let seq): return seq
        case .itemRemoved(_, let seq): return seq
        case .reordered(_, _, _, let seq): return seq
        case .climbMirrored(_, let seq): return seq
        }
    }

    private func applyEvent(_ event: QueueUpdateEvent) {
        switch event {
        case .fullSync(let items, let currentItem, _):
            queueItems = items
            if let currentItem = currentItem {
                currentIndex = items.firstIndex(where: { $0.uuid == currentItem.uuid }) ?? 0
            } else {
                currentIndex = 0
            }

        case .currentClimbChanged(let item, _):
            if let item = item {
                currentIndex = queueItems.firstIndex(where: { $0.uuid == item.uuid }) ?? currentIndex
            }

        case .itemAdded(let item, let position, _):
            let insertIndex = min(max(position, 0), queueItems.count)
            queueItems.insert(item, at: insertIndex)

        case .itemRemoved(let uuid, _):
            if let removeIndex = queueItems.firstIndex(where: { $0.uuid == uuid }) {
                queueItems.remove(at: removeIndex)
                if currentIndex >= queueItems.count {
                    currentIndex = max(0, queueItems.count - 1)
                }
            }

        case .reordered(let uuid, let oldIndex, let newIndex, _):
            guard oldIndex >= 0, oldIndex < queueItems.count else { return }
            let validOldItem = queueItems[oldIndex]
            // Prefer using the oldIndex if the uuid matches, otherwise search
            let item: SharedQueueItem
            if validOldItem.uuid == uuid {
                item = validOldItem
            } else if let found = queueItems.firstIndex(where: { $0.uuid == uuid }) {
                item = queueItems[found]
                queueItems.remove(at: found)
                let dest = min(max(newIndex, 0), queueItems.count)
                queueItems.insert(item, at: dest)
                persistAndNotify()
                return
            } else {
                return
            }
            queueItems.remove(at: oldIndex)
            let dest = min(max(newIndex, 0), queueItems.count)
            queueItems.insert(item, at: dest)

        case .climbMirrored:
            // Ignored for Live Activity display
            return
        }

        persistAndNotify()
    }

    private func persistAndNotify() {
        if let defaults = SharedConstants.sharedDefaults {
            SharedQueueState.save(items: queueItems, currentIndex: currentIndex, to: defaults)
        }
        onQueueStateChanged?(queueItems, currentIndex)
    }

    // MARK: - Reconnection

    private func handleDisconnect() {
        isConnected = false
        webSocketTask = nil

        guard !intentionalDisconnect else { return }

        let delay = reconnectDelay()
        reconnectAttempt += 1

        let workItem = DispatchWorkItem { [weak self] in
            self?.openConnection()
        }
        reconnectWorkItem = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: workItem)
    }

    func reconnectDelay() -> TimeInterval {
        let base: TimeInterval = 1
        let exponential = base * pow(2, Double(reconnectAttempt))
        return min(exponential, maxBackoff)
    }

    // MARK: - Darwin Notification (Queue Navigate)

    private func startDarwinObservation() {
        guard !observingDarwinNotification else { return }
        observingDarwinNotification = true

        let center = CFNotificationCenterGetDarwinNotifyCenter()
        let name = CFNotificationName(SharedConstants.queueNavigateNotification as CFString)
        let observer = Unmanaged.passUnretained(self).toOpaque()

        CFNotificationCenterAddObserver(
            center,
            observer,
            { (_, observer, _, _, _) in
                guard let observer = observer else { return }
                let manager = Unmanaged<SessionWebSocketManager>.fromOpaque(observer).takeUnretainedValue()
                manager.handleQueueNavigateNotification()
            },
            name.rawValue,
            nil,
            .deliverImmediately
        )
    }

    private func stopDarwinObservation() {
        guard observingDarwinNotification else { return }
        observingDarwinNotification = false

        let center = CFNotificationCenterGetDarwinNotifyCenter()
        let observer = Unmanaged.passUnretained(self).toOpaque()
        CFNotificationCenterRemoveObserver(center, observer, nil, nil)
    }

    private func handleQueueNavigateNotification() {
        guard let defaults = SharedConstants.sharedDefaults else { return }
        guard let action = defaults.string(forKey: SharedConstants.pendingActionKey) else { return }

        // Clear the pending action immediately
        defaults.removeObject(forKey: SharedConstants.pendingActionKey)

        switch action {
        case "next":
            let nextIndex = currentIndex + 1
            guard nextIndex < queueItems.count else { return }
            currentIndex = nextIndex
            let item = queueItems[nextIndex]
            persistAndNotify()
            sendSetCurrentClimb(item: item)

        case "previous":
            let prevIndex = currentIndex - 1
            guard prevIndex >= 0 else { return }
            currentIndex = prevIndex
            let item = queueItems[prevIndex]
            persistAndNotify()
            sendSetCurrentClimb(item: item)

        default:
            break
        }
    }

    // MARK: - Transport Helpers

    private func sendJSON(_ dict: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: dict),
              let text = String(data: data, encoding: .utf8)
        else { return }
        webSocketTask?.send(.string(text)) { _ in }
    }
}
