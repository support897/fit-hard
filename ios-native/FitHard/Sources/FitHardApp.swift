import SwiftUI
import UserNotifications

@main
struct FitHardApp: App {
    @StateObject private var store = Store()
    init() { Notifier.registerCategories(); UNUserNotificationCenter.current().delegate = NotifDelegate.shared }
    var body: some Scene {
        WindowGroup {
            Themed().environmentObject(store).onAppear { NotifDelegate.shared.store = store }
                .onReceive(NotificationCenter.default.publisher(for: UIApplication.significantTimeChangeNotification)) { _ in Notifier.rebuild(store) }
        }
    }
}

struct Themed: View {
    @EnvironmentObject var store: Store
    @State private var tab = 0
    var body: some View {
        let th = store.s.settings.theme
        let _ = { Color.pal = th == "black" ? 1 : th == "brown" ? 2 : th == "burrow" ? 3 : 0 }()
        // .id(th) rebuilds every screen so no view keeps the old theme's colours; the tab is kept outside so you stay on it.
        RootView(tab: $tab).id(th).tint(Color.sage).foregroundStyle(Color.ink)
            .preferredColorScheme((th == "white" || th == "burrow") ? .light : .dark)
    }
}

struct RootView: View {
    @EnvironmentObject var store: Store
    @Binding var tab: Int
    var body: some View {
        ZStack(alignment: .bottom) {
            Color.cream.ignoresSafeArea()
            if store.session == nil && !store.bypassDoor {
                DoorView()
            } else if !store.s.onboarded {
                SetupView()
            } else {
                TabView(selection: $tab) {
                    TodayView(go: { tab = $0 }).tabItem { Label("Today", systemImage: "sun.max") }.tag(0)
                    MealsView().tabItem { Label("Meals", systemImage: "fork.knife") }.tag(1)
                    TrainView().tabItem { Label("Train", systemImage: "dumbbell") }.tag(2)
                    NavigationStack { CalendarScreen() }.tabItem { Label("Calendar", systemImage: "calendar") }.tag(3)
                    MoreView().tabItem { Label("More", systemImage: "ellipsis.circle") }.tag(4)
                }
            }
            if let t = store.toast {
                Text(t).font(.subheadline.weight(.semibold)).padding(.horizontal, 16).padding(.vertical, 10)
                    .background(Color.ink, in: Capsule()).foregroundStyle(Color.cream)
                    .padding(.bottom, 100).transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }.animation(.spring(response: 0.35), value: store.toast)
        .fullScreenCover(item: $store.training) { r in TrainingMode(routine: r).environmentObject(store).tint(Color.sage).foregroundStyle(Color.ink) }
    }
}
