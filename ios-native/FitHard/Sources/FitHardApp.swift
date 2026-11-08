import SwiftUI

@main
struct FitHardApp: App {
    @StateObject private var store = Store()
    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .tint(Color.sage)
                .preferredColorScheme(store.s.settings.appearance == "dark" ? .dark : store.s.settings.appearance == "light" ? .light : nil)
        }
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
                    if store.s.profile.needs.contains("peptides") || !store.s.meds.isEmpty {
                        HealthView().tabItem { Label("Health", systemImage: "cross.case") }.tag(3)
                    }
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
