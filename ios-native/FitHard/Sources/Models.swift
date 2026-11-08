import Foundation

struct Ingredient: Codable, Hashable { let name: String; let qty: Double; let unit: String; let category: String? }

struct Recipe: Codable, Identifiable, Hashable {
    let id: String; let name: String; let meal: String; let cuisines: [String]
    let minutes: Int; let servings: Int; let kcal: Int
    let ingredients: [Ingredient]; let steps: [String]
    let allergens: [String]; let meat: Bool
}

struct Exercise: Codable, Identifiable, Hashable {
    let id: String; let name: String; let part: String; let partLabel: String?
    let equipment: String; let level: String; let category: String?
    let cue: String; let anim: String?
}

struct Profile: Codable {
    var name = ""
    var goals: [String] = []
    var needs: [String] = []
    var cuisines: [String] = []
    var allergens: [String] = []
    var vegetarian = false
    var trainDays: [Int] = [2, 4, 6]      // Calendar weekday: 1 = Sunday
    var equipment = "gym"                 // gym | home | body
    var minutes = 30
    var workoutTime = "18:00"
    var waterGoal = 2000
}

struct TaskItem: Codable, Identifiable, Hashable {
    var id = UUID(); var title: String; var day: String? = nil; var time: String? = nil; var done = false
}
struct Med: Codable, Identifiable, Hashable {
    var id = UUID(); var name: String; var amount: String = ""; var time: String = "08:00"
}
struct MedLog: Codable, Identifiable, Hashable {
    var id = UUID(); var medId: UUID; var day: String; var status: String; var at = Date()
}
struct Appt: Codable, Identifiable, Hashable {
    var id = UUID(); var title: String; var date: Date
}
struct SetLog: Codable, Hashable { var reps: Int; var kg: Double }
struct Entry: Codable, Hashable, Identifiable { var id = UUID(); var exerciseId: String; var sets: [SetLog] = [] }
struct WorkoutLog: Codable, Identifiable, Hashable {
    var id = UUID(); var date = Date(); var entries: [Entry]
}

struct Settings: Codable {
    /// Reminder groups the user has turned on: workout, water, meals, tasks, health
    var on: [String] = ["workout", "tasks", "health"]
    var waterTime = "12:00"
    var breakfast = "08:00"
    var lunch = "12:30"
    var dinner = "18:30"
    var detailsOnLock = false
    var appearance = "system"   // system | light | dark
}

struct AppState: Codable {
    var onboarded = false
    var profile = Profile()
    var water: [String: Int] = [:]
    var plan: [String: [String: String]] = [:]   // day -> meal -> recipe id
    var eaten: [String: [String]] = [:]          // day -> meals eaten
    var checkins: [String: String] = [:]
    var routine: [String: [String]] = [:]        // weekday -> exercise ids
    var tasks: [TaskItem] = []
    var meds: [Med] = []
    var medLogs: [MedLog] = []
    var appts: [Appt] = []
    var workouts: [WorkoutLog] = []
    var groceryChecked: [String] = []
    var settings = Settings()
}

enum Lists {
    static let goals = ["Lose weight gently", "Build strength", "Feel fitter", "Eat more regularly", "Keep track of my doses"]
    static let goalIcons = ["scalemass", "dumbbell", "figure.run", "fork.knife", "pills"]
    struct Need: Identifiable { let id: String; let label: String; let icon: String }
    static let needs = [
        Need(id: "meals", label: "Meal plans", icon: "fork.knife"),
        Need(id: "calories", label: "Calorie counts", icon: "flame"),
        Need(id: "gym", label: "Gym routines", icon: "dumbbell"),
        Need(id: "peptides", label: "Dose tracking", icon: "pills"),
        Need(id: "calendar", label: "Calendar and habits", icon: "calendar")
    ]
    static let cuisines = ["Mexican", "Greek", "Mediterranean", "Italian", "Asian", "Indian", "American", "Australian", "Healthy", "Comfort", "Quick"]
    static let allergens: [(id: String, label: String)] = [
        ("milk", "Dairy"), ("gluten", "Gluten"), ("egg", "Egg"), ("peanut", "Peanut"),
        ("tree_nut", "Tree nuts"), ("soy", "Soy"), ("sesame", "Sesame")
    ]
    static let meals = ["breakfast", "lunch", "dinner"]
    static let weekdays = [(2, "Mon"), (3, "Tue"), (4, "Wed"), (5, "Thu"), (6, "Fri"), (7, "Sat"), (1, "Sun")]
    static let checkins = [("bad", "Bad", "A softer day is planned for you."), ("ok", "Ok", "Your normal plan, as it is."), ("great", "Great", "Full plan, plus one optional extra.")]
}

final class Catalog {
    static let shared = Catalog()
    let recipes: [Recipe]
    let exercises: [Exercise]
    private let byId: [String: Recipe]
    private let exById: [String: Exercise]
    init() {
        func load<T: Decodable>(_ name: String, _ type: T.Type) -> T? {
            guard let url = Bundle.main.url(forResource: name, withExtension: "json"),
                  let d = try? Data(contentsOf: url) else { return nil }
            return try? JSONDecoder().decode(T.self, from: d)
        }
        recipes = load("recipes", [Recipe].self) ?? []
        exercises = load("exercises", [Exercise].self) ?? []
        byId = Dictionary(recipes.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        exById = Dictionary(exercises.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
    }
    func recipe(_ id: String) -> Recipe? { byId[id] }
    func exercise(_ id: String) -> Exercise? { exById[id] }
}
