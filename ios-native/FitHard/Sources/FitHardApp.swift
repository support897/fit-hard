import SwiftUI

@main
struct FitHardApp: App {
    @StateObject private var store = Store()
    var body: some Scene {
        WindowGroup {
            Themed().environmentObject(store)
        }
    }
}

struct Themed: View {
    @EnvironmentObject var store: Store
    var body: some View {
        let th = store.s.settings.theme
        let _ = { Color.pal = th == "black" ? 1 : th == "brown" ? 2 : 0 }()
        RootView().tint(Color.sage).foregroundStyle(Color.ink)
            .preferredColorScheme(th == "white" ? .light : .dark)
    }
}

struct RootView: View {
    @EnvironmentObject var store: Store
    @State private var tab = 0
    var body: some View {
        ZStack(alignment: .bottom) {
            Color.cream.ignoresSafeArea()
            if !store.s.onboarded {
                OnboardingView()
            } else {
                TabView(selection: $tab) {
                    TodayView(go: { tab = $0 }).tabItem { Label("Today", systemImage: "sun.max") }.tag(0)
                    FoodView().tabItem { Label("Food", systemImage: "fork.knife") }.tag(1)
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
    }
}
