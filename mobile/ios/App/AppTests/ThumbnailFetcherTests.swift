import XCTest
@testable import App

// MARK: - Mock URL Protocol

/// A URLProtocol subclass that intercepts all requests and returns
/// configurable responses for testing.
final class MockURLProtocol: URLProtocol {

    /// Handler called for each request. Set this before running tests.
    static var requestHandler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    /// Tracks all requests made during a test.
    static var receivedRequests: [URLRequest] = []

    static func reset() {
        requestHandler = nil
        receivedRequests = []
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        MockURLProtocol.receivedRequests.append(request)

        guard let handler = MockURLProtocol.requestHandler else {
            client?.urlProtocol(self, didFailWithError: URLError(.unknown))
            return
        }

        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

// MARK: - ThumbnailFetcherTests

final class ThumbnailFetcherTests: XCTestCase {

    private var tempDirectory: URL!
    private var defaults: UserDefaults!
    private var defaultsSuiteName: String!
    private var session: URLSession!

    override func setUp() {
        super.setUp()

        // Create a temp directory to act as the shared container.
        tempDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent("ThumbnailFetcherTests-\(UUID().uuidString)")
        try? FileManager.default.createDirectory(at: tempDirectory, withIntermediateDirectories: true)

        // Use a unique suite name so tests don't interfere.
        defaultsSuiteName = "ThumbnailFetcherTests-\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: defaultsSuiteName)!

        // Populate board details in shared defaults.
        defaults.set("https://boardsesh.com", forKey: SharedConstants.serverUrlKey)
        defaults.set("kilter", forKey: SharedConstants.boardNameKey)
        defaults.set(1, forKey: SharedConstants.layoutIdKey)
        defaults.set(10, forKey: SharedConstants.sizeIdKey)
        defaults.set("12,34", forKey: SharedConstants.setIdsKey)

        // Configure URLSession with mock protocol.
        MockURLProtocol.reset()
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        session = URLSession(configuration: config)
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: tempDirectory)
        UserDefaults.standard.removePersistentDomain(forName: defaultsSuiteName)
        MockURLProtocol.reset()
        super.tearDown()
    }

    // MARK: - Helpers

    private func makeFetcher() -> ThumbnailFetcher {
        ThumbnailFetcher(
            urlSession: session,
            fileManager: .default,
            sharedDefaults: defaults,
            sharedContainerUrl: tempDirectory
        )
    }

    private func makeQueueItem(
        uuid: String = UUID().uuidString,
        climbUuid: String = UUID().uuidString,
        frames: String = "p1r12p2r13"
    ) -> SharedQueueItem {
        SharedQueueItem(
            uuid: uuid,
            climbUuid: climbUuid,
            climbName: "Test Climb",
            difficulty: "V5",
            angle: 40,
            frames: frames,
            setterUsername: "tester"
        )
    }

    private func installSuccessHandler(data: Data = Data([0xFF, 0xD8, 0xFF])) {
        MockURLProtocol.requestHandler = { request in
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: nil,
                headerFields: ["Cache-Control": "public, max-age=31536000, immutable"]
            )!
            return (response, data)
        }
    }

    // MARK: - Tests

    func testBuildThumbnailURL() async {
        let fetcher = makeFetcher()
        let item = makeQueueItem(frames: "p1r12p2r13")

        let url = await fetcher.buildThumbnailURL(for: item)

        XCTAssertNotNil(url)
        let urlString = url!.absoluteString
        XCTAssertTrue(urlString.contains("board_name=kilter"), "URL should contain board_name")
        XCTAssertTrue(urlString.contains("layout_id=1"), "URL should contain layout_id")
        XCTAssertTrue(urlString.contains("size_id=10"), "URL should contain size_id")
        XCTAssertTrue(urlString.contains("set_ids=12,34"), "URL should contain set_ids")
        XCTAssertTrue(urlString.contains("frames=p1r12p2r13"), "URL should contain frames")
        XCTAssertTrue(urlString.contains("thumbnail=1"), "URL should contain thumbnail flag")
        XCTAssertTrue(urlString.hasPrefix("https://boardsesh.com/api/internal/board-render"))
    }

    func testURLEncodesFramesParameter() async {
        let fetcher = makeFetcher()
        // Frames with special characters that need encoding.
        let item = makeQueueItem(frames: "p1r12+p2r13/p3=14")

        let url = await fetcher.buildThumbnailURL(for: item)

        XCTAssertNotNil(url)
        let urlString = url!.absoluteString

        // The `+`, `/`, and `=` characters should be percent-encoded in
        // the query string by URLComponents.
        XCTAssertFalse(
            urlString.contains("frames=p1r12+p2r13/p3=14"),
            "Special characters in frames should be URL-encoded, not literal"
        )
        // Verify the decoded query item value is correct.
        let components = URLComponents(url: url!, resolvingAgainstBaseURL: false)
        let framesValue = components?.queryItems?.first(where: { $0.name == "frames" })?.value
        XCTAssertEqual(framesValue, "p1r12+p2r13/p3=14")
    }

    func testSavesToCorrectPath() async {
        let fetcher = makeFetcher()
        let climbUuid = "test-climb-uuid-123"
        let item = makeQueueItem(climbUuid: climbUuid)
        let imageData = Data([0x52, 0x49, 0x46, 0x46]) // RIFF header stub

        installSuccessHandler(data: imageData)

        let fileURL = await fetcher.fetchThumbnail(for: item)

        XCTAssertNotNil(fileURL)

        let expectedPath = tempDirectory
            .appendingPathComponent("thumbnails")
            .appendingPathComponent("\(climbUuid).webp")
        XCTAssertEqual(fileURL, expectedPath)
        XCTAssertTrue(FileManager.default.fileExists(atPath: expectedPath.path))

        // Verify written data matches.
        let writtenData = try? Data(contentsOf: expectedPath)
        XCTAssertEqual(writtenData, imageData)
    }

    func testEvictsOldThumbnails() async {
        let fetcher = makeFetcher()

        // Create the thumbnails directory.
        let thumbDir = tempDirectory.appendingPathComponent("thumbnails")
        try! FileManager.default.createDirectory(at: thumbDir, withIntermediateDirectories: true)

        // Pre-populate 12 files with staggered modification dates.
        for i in 0..<12 {
            let fileURL = thumbDir.appendingPathComponent("old-\(i).webp")
            try! Data([UInt8(i)]).write(to: fileURL)
            let date = Date(timeIntervalSince1970: TimeInterval(i * 100))
            try! FileManager.default.setAttributes(
                [.modificationDate: date],
                ofItemAtPath: fileURL.path
            )
        }

        // Verify we start with 12 files.
        let beforeFiles = try! FileManager.default.contentsOfDirectory(atPath: thumbDir.path)
        XCTAssertEqual(beforeFiles.count, 12)

        await fetcher.evictOldThumbnails()

        let afterFiles = try! FileManager.default.contentsOfDirectory(atPath: thumbDir.path)
        XCTAssertEqual(afterFiles.count, ThumbnailFetcher.maxCachedThumbnails)

        // The two oldest files (old-0 and old-1) should have been removed.
        XCTAssertFalse(FileManager.default.fileExists(atPath: thumbDir.appendingPathComponent("old-0.webp").path))
        XCTAssertFalse(FileManager.default.fileExists(atPath: thumbDir.appendingPathComponent("old-1.webp").path))
        // The newest file should still exist.
        XCTAssertTrue(FileManager.default.fileExists(atPath: thumbDir.appendingPathComponent("old-11.webp").path))
    }

    func testHandlesFetchFailureGracefully() async {
        let fetcher = makeFetcher()
        let item = makeQueueItem()

        // Configure mock to return a network error.
        MockURLProtocol.requestHandler = { _ in
            throw URLError(.notConnectedToInternet)
        }

        let result = await fetcher.fetchThumbnail(for: item)

        XCTAssertNil(result, "Should return nil on network failure without crashing")
    }

    func testPreFetchesAdjacentItems() async {
        let fetcher = makeFetcher()

        let items = (0..<5).map { i in
            makeQueueItem(
                uuid: "queue-\(i)",
                climbUuid: "climb-\(i)",
                frames: "frame\(i)"
            )
        }

        installSuccessHandler()

        // Pre-fetch around index 2 -- should fetch indices 1, 2, 3.
        await fetcher.preFetchAdjacentThumbnails(queue: items, currentIndex: 2)

        let thumbDir = tempDirectory.appendingPathComponent("thumbnails")
        let cachedFiles = (try? FileManager.default.contentsOfDirectory(atPath: thumbDir.path)) ?? []

        XCTAssertTrue(cachedFiles.contains("climb-1.webp"), "Previous item should be pre-fetched")
        XCTAssertTrue(cachedFiles.contains("climb-2.webp"), "Current item should be pre-fetched")
        XCTAssertTrue(cachedFiles.contains("climb-3.webp"), "Next item should be pre-fetched")
        XCTAssertFalse(cachedFiles.contains("climb-0.webp"), "Item two before should not be fetched")
        XCTAssertFalse(cachedFiles.contains("climb-4.webp"), "Item two after should not be fetched")
    }

    func testPreFetchHandlesEdgeIndices() async {
        let fetcher = makeFetcher()

        let items = (0..<3).map { i in
            makeQueueItem(uuid: "q-\(i)", climbUuid: "c-\(i)")
        }

        installSuccessHandler()

        // Pre-fetch at index 0 -- should only fetch 0 and 1 (no -1).
        await fetcher.preFetchAdjacentThumbnails(queue: items, currentIndex: 0)

        let thumbDir = tempDirectory.appendingPathComponent("thumbnails")
        let cachedFiles = (try? FileManager.default.contentsOfDirectory(atPath: thumbDir.path)) ?? []

        XCTAssertTrue(cachedFiles.contains("c-0.webp"))
        XCTAssertTrue(cachedFiles.contains("c-1.webp"))
        XCTAssertEqual(cachedFiles.count, 2)
    }

    func testReturnsCachedFileWithoutNetwork() async {
        let fetcher = makeFetcher()
        let climbUuid = "cached-climb"
        let item = makeQueueItem(climbUuid: climbUuid)

        // Pre-populate the cache.
        let thumbDir = tempDirectory.appendingPathComponent("thumbnails")
        try! FileManager.default.createDirectory(at: thumbDir, withIntermediateDirectories: true)
        let cachedPath = thumbDir.appendingPathComponent("\(climbUuid).webp")
        try! Data([0x01]).write(to: cachedPath)

        // Configure mock to fail -- should not be called.
        MockURLProtocol.requestHandler = { _ in
            throw URLError(.notConnectedToInternet)
        }

        let result = await fetcher.fetchThumbnail(for: item)

        XCTAssertEqual(result, cachedPath)
        // No network requests should have been made.
        XCTAssertTrue(MockURLProtocol.receivedRequests.isEmpty)
    }
}
