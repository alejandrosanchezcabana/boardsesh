import UIKit
import Capacitor

class BoardseshViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()

        // Disable rubber-band bounce so the page cannot overscroll
        webView?.scrollView.bounces = false
    }
}
