import SwiftUI
import UserNotifications
import GoogleSignIn

@main
struct FitHardApp: App {
    @StateObject private var store = Store()
    init() { FHFonts.register(); Notifier.registerCategories(); UNUserNotificationCenter.current().delegate = NotifDelegate.shared }
    var body: some Scene {
        WindowGroup {
            Themed().environmentObject(store).onOpenURL { _ = GIDSignIn.sharedInstance.handle($0) }.onAppear { NotifDelegate.shared.store = store }
                .onReceive(NotificationCenter.default.publisher(for: UIApplication.significantTimeChangeNotification)) { _ in Notifier.rebuild(store) }
        }
    }
}

struct Themed: View {
    @EnvironmentObject var store: Store
    @State private var tab = 0
    var body: some View {
        let th = store.s.settings.theme
        let _ = { Color.pal = th == "dark" ? 1 : th == "beige" ? 2 : th == "brand" ? 3 : 0 }()
        // .id(th) rebuilds every screen so no view keeps the old theme's colours; the tab is kept outside so you stay on it.
        RootView(tab: $tab).id(th).environment(\.locale, Locale(identifier: store.s.language)).tint(Color.sage).foregroundStyle(Color.ink)
            .preferredColorScheme(th == "dark" ? .dark : .light)
    }
}

struct RootView: View {
    @EnvironmentObject var store: Store
    @Binding var tab: Int
    /// Tabs mount on first visit and stay alive after, like a tab view —
    /// scroll and stacks are kept when switching (build 37, the designed bar).
    @State private var visited: Set<Int> = [0]
    var body: some View {
        ZStack(alignment: .bottom) {
            Color.cream.ignoresSafeArea()
            if store.session == nil && !store.bypassDoor {
                DoorView()
            } else if !store.s.onboarded || store.needsPersonalization {
                SetupView()
            } else {
                VStack(spacing: 0) {
                    ZStack {
                        if visited.contains(0) { TodayView(go: { tab = $0 }).opacity(tab == 0 ? 1 : 0).allowsHitTesting(tab == 0).accessibilityHidden(tab != 0) }
                        if visited.contains(1) { MealsView().opacity(tab == 1 ? 1 : 0).allowsHitTesting(tab == 1).accessibilityHidden(tab != 1) }
                        if visited.contains(2) { TrainView().opacity(tab == 2 ? 1 : 0).allowsHitTesting(tab == 2).accessibilityHidden(tab != 2) }
                        if visited.contains(3) { NavigationStack { CalendarScreen() }.opacity(tab == 3 ? 1 : 0).allowsHitTesting(tab == 3).accessibilityHidden(tab != 3) }
                        if visited.contains(4) { HealthView().opacity(tab == 4 ? 1 : 0).allowsHitTesting(tab == 4).accessibilityHidden(tab != 4) }
                        if visited.contains(5) { MoreView().opacity(tab == 5 ? 1 : 0).allowsHitTesting(tab == 5).accessibilityHidden(tab != 5) }
                    }.frame(maxWidth: .infinity, maxHeight: .infinity)
                    BottomTabBar(tab: $tab)
                }.onChange(of: tab) { visited.insert($0) }
            }
            if let t = store.toast {
                Text(LocalizedStringKey(t)).font(.fh_subheadline_b).padding(.horizontal, 16).padding(.vertical, 10)
                    .background(Color.ink, in: Capsule()).foregroundStyle(Color.cream)
                    .padding(.bottom, 100).transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }.animation(.spring(response: 0.35), value: store.toast)
        .fullScreenCover(item: $store.training) { r in TrainingMode(routine: r).environmentObject(store).tint(Color.sage).foregroundStyle(Color.ink) }
    }
}

/// The designed bottom bar (build 37): six tabs standing side by side — Today,
/// Meals, Train, Calendar, My Doses, More. SwiftUI's own tab view hides every
/// tab past the fifth behind a system list, and her word is that My Doses
/// stands in the bottom as its own menu, so the bar is drawn here in brand.
/// Icons are the designed glyphs of record, labels always stand under them.
struct BottomTabBar: View {
    @Binding var tab: Int
    private let items: [(title: String, icon: String, id: String)] = [
        ("Today", "sun.max", "tab-today"),
        ("Meals", "fork.knife", "tab-meals"),
        ("Train", "dumbbell", "tab-train"),
        ("Calendar", "calendar", "tab-calendar"),
        ("My Doses", "cross.case", "tab-doses"),
        ("More", "ellipsis.circle", "tab-more"),
    ]
    var body: some View {
        HStack(spacing: 0) {
            ForEach(items.indices, id: \.self) { i in
                Button { tab = i } label: {
                    VStack(spacing: 2) {
                        BrandIcon.tabImage(items[i].icon).resizable().scaledToFit().frame(width: 24, height: 24)
                        Text(LocalizedStringKey(items[i].title)).font(.fh_caption).lineLimit(1).minimumScaleFactor(0.8)
                    }.frame(maxWidth: .infinity).padding(.vertical, 6)
                    .foregroundStyle(tab == i ? Color.sage : Color.muted)
                    .contentShape(Rectangle())
                }.buttonStyle(.plain).accessibilityIdentifier(items[i].id)
                .accessibilityLabel(LocalizedStringKey(items[i].title))
            }
        }.padding(.horizontal, 4)
        .background(Color.cream)
        .overlay(alignment: .top) { Rectangle().fill(Color.tint).frame(height: 1) }
        .accessibilityIdentifier("tab-bar")
    }
}

/// Swipe law: sliding from the left edge goes back one page on every pushed screen, even where a custom back button hides the system one.
extension UINavigationController: UIGestureRecognizerDelegate {
    override open func viewDidLoad() {
        super.viewDidLoad()
        interactivePopGestureRecognizer?.delegate = self
    }
    public func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool { viewControllers.count > 1 }
}
