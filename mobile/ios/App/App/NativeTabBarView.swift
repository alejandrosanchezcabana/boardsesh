import UIKit

// MARK: - Tab Definition

private struct TabDefinition {
    let tabKey: String
    let inactiveSymbol: String
    let activeSymbol: String
    let label: String
}

// MARK: - NativeTabBarView

public class NativeTabBarView: UIView {

    // MARK: - Constants

    private static let contentHeight: CGFloat = 49
    static let activeColor = UIColor(red: 0.549, green: 0.290, blue: 0.322, alpha: 1.0)
    static let inactiveColor = UIColor(red: 0.612, green: 0.639, blue: 0.686, alpha: 1.0)
    private static let iconSize: CGFloat = 22
    private static let labelSize: CGFloat = 10
    private static let badgeColor = UIColor(red: 0.937, green: 0.267, blue: 0.267, alpha: 1.0)

    private static let tabs: [TabDefinition] = [
        TabDefinition(tabKey: "home",          inactiveSymbol: "house",        activeSymbol: "house.fill",        label: "Home"),
        TabDefinition(tabKey: "climbs",        inactiveSymbol: "list.bullet",  activeSymbol: "list.bullet",       label: "Climb"),
        TabDefinition(tabKey: "library",       inactiveSymbol: "tag",          activeSymbol: "tag.fill",          label: "Discover"),
        TabDefinition(tabKey: "feed",          inactiveSymbol: "square.stack", activeSymbol: "square.stack.fill", label: "Feed"),
        TabDefinition(tabKey: "create",        inactiveSymbol: "plus",         activeSymbol: "plus",              label: "Create"),
        TabDefinition(tabKey: "notifications", inactiveSymbol: "bell",         activeSymbol: "bell.fill",         label: "Notifications"),
    ]

    // MARK: - Public Interface

    public var onTabTapped: ((String) -> Void)?

    // MARK: - Private State

    private var tabButtons: [String: UIButton] = [:]
    private var tabLabels: [String: UILabel] = [:]
    private var activeTabKey: String = "home"
    private var notificationBadge: UILabel!
    private var blurView: UIVisualEffectView!
    private var stackView: UIStackView!

    // MARK: - Init

    public override init(frame: CGRect) {
        super.init(frame: frame)
        setupView()
    }

    public required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupView()
    }

    // MARK: - Setup

    private func setupView() {
        backgroundColor = .clear
        setupBlurBackground()
        setupStackView()
        setupTabButtons()
    }

    private func setupBlurBackground() {
        let effect = UIBlurEffect(style: .systemThinMaterialDark)
        blurView = UIVisualEffectView(effect: effect)
        blurView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(blurView)

        NSLayoutConstraint.activate([
            blurView.leadingAnchor.constraint(equalTo: leadingAnchor),
            blurView.trailingAnchor.constraint(equalTo: trailingAnchor),
            blurView.topAnchor.constraint(equalTo: topAnchor),
            blurView.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
    }

    private func setupStackView() {
        stackView = UIStackView()
        stackView.axis = .horizontal
        stackView.distribution = .fillEqually
        stackView.alignment = .fill
        stackView.translatesAutoresizingMaskIntoConstraints = false
        blurView.contentView.addSubview(stackView)

        NSLayoutConstraint.activate([
            stackView.leadingAnchor.constraint(equalTo: blurView.contentView.leadingAnchor),
            stackView.trailingAnchor.constraint(equalTo: blurView.contentView.trailingAnchor),
            stackView.topAnchor.constraint(equalTo: blurView.contentView.topAnchor),
            stackView.heightAnchor.constraint(equalToConstant: NativeTabBarView.contentHeight),
        ])
    }

    private func setupTabButtons() {
        for (index, tabDef) in NativeTabBarView.tabs.enumerated() {
            let (button, titleLabel) = buildTabButton(tabDef, index: index)
            tabButtons[tabDef.tabKey] = button
            tabLabels[tabDef.tabKey] = titleLabel
            stackView.addArrangedSubview(button)

            if tabDef.tabKey == "notifications" {
                setupNotificationBadge(on: button)
            }
        }

        updateButtonAppearances()
    }

    private func buildTabButton(_ tabDef: TabDefinition, index: Int) -> (UIButton, UILabel) {
        let button = UIButton(type: .custom)
        button.tag = index
        button.accessibilityIdentifier = "tab-\(tabDef.tabKey)"
        button.addTarget(self, action: #selector(tabButtonTapped(_:)), for: .touchUpInside)

        let iconConfig = UIImage.SymbolConfiguration(pointSize: NativeTabBarView.iconSize, weight: .light)
        let inactiveImage = UIImage(systemName: tabDef.inactiveSymbol, withConfiguration: iconConfig)
        let activeImage = UIImage(systemName: tabDef.activeSymbol, withConfiguration: iconConfig)

        button.setImage(inactiveImage, for: .normal)
        button.setImage(activeImage, for: .selected)
        button.tintColor = NativeTabBarView.inactiveColor

        let titleLabel = UILabel()
        titleLabel.text = tabDef.label
        titleLabel.font = .systemFont(ofSize: NativeTabBarView.labelSize)
        titleLabel.textAlignment = .center
        titleLabel.textColor = NativeTabBarView.inactiveColor
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.isUserInteractionEnabled = false

        button.addSubview(titleLabel)

        NSLayoutConstraint.activate([
            titleLabel.leadingAnchor.constraint(equalTo: button.leadingAnchor),
            titleLabel.trailingAnchor.constraint(equalTo: button.trailingAnchor),
            titleLabel.bottomAnchor.constraint(equalTo: button.bottomAnchor, constant: -4),
        ])

        return (button, titleLabel)
    }

    private func setupNotificationBadge(on button: UIButton) {
        notificationBadge = UILabel()
        notificationBadge.backgroundColor = NativeTabBarView.badgeColor
        notificationBadge.textColor = .white
        notificationBadge.font = .systemFont(ofSize: 9, weight: .bold)
        notificationBadge.textAlignment = .center
        notificationBadge.clipsToBounds = true
        notificationBadge.layer.cornerRadius = 7
        notificationBadge.isHidden = true
        notificationBadge.translatesAutoresizingMaskIntoConstraints = false

        button.addSubview(notificationBadge)

        NSLayoutConstraint.activate([
            notificationBadge.topAnchor.constraint(equalTo: button.topAnchor, constant: 4),
            notificationBadge.leadingAnchor.constraint(equalTo: button.centerXAnchor, constant: 4),
            notificationBadge.heightAnchor.constraint(equalToConstant: 14),
            notificationBadge.widthAnchor.constraint(greaterThanOrEqualToConstant: 14),
        ])
    }

    // MARK: - Button Tap

    @objc private func tabButtonTapped(_ sender: UIButton) {
        let index = sender.tag
        guard index >= 0, index < NativeTabBarView.tabs.count else { return }
        let tab = NativeTabBarView.tabs[index]
        setActiveTab(tab.tabKey)
        onTabTapped?(tab.tabKey)
    }

    // MARK: - Public Methods

    public func setActiveTab(_ tab: String) {
        activeTabKey = tab
        updateButtonAppearances()
    }

    public func setNotificationBadge(_ count: Int) {
        guard notificationBadge != nil else { return }
        if count <= 0 {
            notificationBadge.isHidden = true
        } else {
            notificationBadge.isHidden = false
            notificationBadge.text = count > 99 ? "99+" : "\(count)"
        }
    }

    // MARK: - Private Helpers

    private func updateButtonAppearances() {
        for tabDef in NativeTabBarView.tabs {
            guard let button = tabButtons[tabDef.tabKey] else { continue }
            let isActive = tabDef.tabKey == activeTabKey
            let color = isActive ? NativeTabBarView.activeColor : NativeTabBarView.inactiveColor

            button.tintColor = color
            button.isSelected = isActive
            tabLabels[tabDef.tabKey]?.textColor = color
        }
    }
}
