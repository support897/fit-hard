import Foundation

struct Ingredient: Codable, Hashable { let name: String; let qty: Double; let unit: String; let category: String? }

struct Recipe: Codable, Identifiable, Hashable {
    let id: String; let name: String; let meal: String; let cuisines: [String]
    let minutes: Int; let servings: Int; let kcal: Int
    let ingredients: [Ingredient]; let steps: [String]
    let allergens: [String]; let meat: Bool; let honey: Bool?
}

struct Exercise: Codable, Identifiable, Hashable {
    let id: String; let name: String; let part: String; let partLabel: String?
    let equipment: String; let level: String; let category: String?
    let cue: String; let anim: String?
}

struct Profile: Codable {
    var name = ""
    var goals: [String] = []
    var primaryGoal = ""
    var needs: [String] = []
    var cuisines: [String] = []
    var allergens: [String] = []
    var vegetarian = false
    var trainDays: [Int] = [2, 4, 6]      // Calendar weekday: 1 = Sunday
    var equipment = "gym"                 // gym | home | body
    var minutes = 30
    var workoutTime = "18:00"
    var waterGoal = 2000
    // Personal Fitness Profile (spec section 2). One shared record read by every screen.
    var age = 0
    var heightCm = 0.0
    var weightKg = 0.0
    var targetKg = 0.0
    var imperial = false
    var calcBasis = "avg"                 // female | male | avg  (only used for the resting energy estimate)
    var character = ""                    // boy | girl | nonbinary  (look only, never used in any calculation)
    var experience = "beginner"           // beginner | intermediate | advanced
    var activity = "light"                // sedentary | light | moderate | active
    var trainType = "strength"
    var location = "gym"                  // gym | home | both
    var bodyFocus: [String: String] = [:] // body part -> priority | less
    var kit: [String] = []                // equipment the user has
    var diet = "any"                      // any | vegetarian | vegan | pescatarian
    var dislikes: [String] = []
    var mealsPerDay = 3
    var cookMinutes = 30
    var budget = "medium"
    var minor = false
    var pregnant = false
    var edConcern = false
    var clinicianLimits = false
    var injury = ""
    var trainMode = "hybrid"              // timer | guided | hybrid
    var setupDone = false
    var profileVersion = 2
    /// Workouts per week the home page counts toward. Saved together with the days pick (0 = follow the days pick).
    var weekGoal = 0
    init() {}
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        name = c.v(.name, ""); goals = c.v(.goals, []); primaryGoal = c.v(.primaryGoal, ""); needs = c.v(.needs, []); cuisines = c.v(.cuisines, [])
        allergens = c.v(.allergens, []); vegetarian = c.v(.vegetarian, false); trainDays = c.v(.trainDays, [2, 4, 6])
        equipment = c.v(.equipment, "gym"); minutes = c.v(.minutes, 30); workoutTime = c.v(.workoutTime, "18:00"); waterGoal = c.v(.waterGoal, 2000)
        age = c.v(.age, 0); heightCm = c.v(.heightCm, 0); weightKg = c.v(.weightKg, 0); targetKg = c.v(.targetKg, 0); imperial = c.v(.imperial, false)
        calcBasis = c.v(.calcBasis, "avg"); character = c.v(.character, ""); experience = c.v(.experience, "beginner"); activity = c.v(.activity, "light")
        trainType = c.v(.trainType, "strength"); location = c.v(.location, "gym"); bodyFocus = c.v(.bodyFocus, [:]); kit = c.v(.kit, [])
        diet = c.v(.diet, "any"); dislikes = c.v(.dislikes, []); mealsPerDay = c.v(.mealsPerDay, 3); cookMinutes = c.v(.cookMinutes, 30); budget = c.v(.budget, "medium")
        minor = c.v(.minor, false); pregnant = c.v(.pregnant, false); edConcern = c.v(.edConcern, false); clinicianLimits = c.v(.clinicianLimits, false)
        injury = c.v(.injury, ""); trainMode = c.v(.trainMode, "hybrid"); setupDone = c.v(.setupDone, false); profileVersion = c.v(.profileVersion, 2); weekGoal = c.v(.weekGoal, 0)
    }
}

struct TaskItem: Codable, Identifiable, Hashable {
    var id = UUID(); var title: String; var day: String? = nil; var time: String? = nil; var done = false
}
struct Med: Codable, Identifiable, Hashable {
    var id = UUID(); var name: String; var amount: String = ""; var time: String = "08:00"
    // Everything below is typed in by the user from what their own clinician told them. Nothing is ever suggested.
    var unit: String? = nil; var route: String? = nil; var frequency: String? = nil; var instructions: String? = nil
    var prescriber: String? = nil; var paused: Bool? = nil; var times: [String]? = nil
    var isPaused: Bool { paused ?? false }
    var allTimes: [String] { (times?.isEmpty == false ? times! : [time]) }
}
struct MedLog: Codable, Identifiable, Hashable {
    var id = UUID(); var medId: UUID; var day: String; var status: String; var at = Date()
}
struct Appt: Codable, Identifiable, Hashable {
    var id = UUID(); var title: String; var date: Date
}
struct SetLog: Codable, Hashable { var reps: Int; var kg: Double; var done: Bool? = nil; var rpe: Int? = nil; var note: String? = nil }
struct Entry: Codable, Hashable, Identifiable { var id = UUID(); var exerciseId: String; var sets: [SetLog] = []; var painFlag: Bool? = nil; var difficulty: Int? = nil }
struct WorkoutLog: Codable, Identifiable, Hashable {
    var id = UUID(); var date = Date(); var entries: [Entry]
    var seconds: Int? = nil; var routineId: String? = nil; var routineName: String? = nil
}

struct Treat: Codable, Identifiable, Hashable { var id = UUID(); var day: String; var name: String; var kcal: Int? = nil }
struct Habit: Codable, Identifiable, Hashable { var id = UUID(); var name: String; var time: String? = nil; var done: [String] = [] }
struct BodyEntry: Codable, Identifiable, Hashable {
    var id = UUID(); var day: String
    var weight: Double? = nil; var waist: Double? = nil; var hips: Double? = nil
    var chest: Double? = nil; var arm: Double? = nil; var thigh: Double? = nil
}
struct InvItem: Codable, Identifiable, Hashable { var id = UUID(); var name: String; var qty: Double; var unit: String; var expiry: String? = nil }
struct ShopItem: Codable, Identifiable, Hashable { var id = UUID(); var name: String; var qty: Double; var unit: String; var cat: String = "Other"; var done = false }
struct CalEvent: Codable, Identifiable, Hashable {
    var id = UUID(); var title: String; var day: String; var time: String = "09:00"; var minutes: Int = 30
    var cat: String = "personal"      // training | meals | recovery | medication | personal
    var kind: String = "custom"       // workout | meal | snack | cardio | rest | personal | custom | medication
    var notes: String = ""; var remind: Bool = true; var done: Bool = false; var link: String? = nil
}
struct Routine: Codable, Identifiable, Hashable {
    var id = UUID(); var name: String; var weekday: Int; var focus: [String]; var exIds: [String]
    var customized = false; var block = 1; var week = 1
    var kind: String? = nil
    var trainType: TrainType { TrainType.infer(name: name, kind: kind) }
}
struct WallyNote: Codable, Hashable { var day: String; var rule: String }
struct Reflection: Codable, Hashable { var easier = ""; var change = ""; var next = "" }
struct Challenge: Codable, Hashable { var start: String; var days: Int; var tasks: [String] }

struct Settings: Codable {
    /// Reminder groups the user has turned on: workout, water, meals, tasks, health
    var on: [String] = ["workout", "tasks", "health"]
    var waterTime = "12:00"
    var breakfast = "08:00"
    var lunch = "12:30"
    var dinner = "18:30"
    var detailsOnLock = false
    var appearance = "system"   // legacy, unused
    var theme = "white"         // white (default) | dark | beige | brand
    var quietFrom = "22:00"; var quietTo = "07:00"; var lead = 10; var wallyQuiet = false
    init() {}
    /// Older saves used burrow, black and brown. They map onto the four themes of build 32.
    static func normalTheme(_ t: String) -> String {
        switch t { case "white", "dark", "beige", "brand": return t; case "black", "brown": return "dark"; case "burrow": return "beige"; default: return "white" }
    }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        on = c.v(.on, ["workout", "tasks", "health"]); waterTime = c.v(.waterTime, "12:00"); breakfast = c.v(.breakfast, "08:00")
        lunch = c.v(.lunch, "12:30"); dinner = c.v(.dinner, "18:30"); detailsOnLock = c.v(.detailsOnLock, false); appearance = c.v(.appearance, "system"); theme = Settings.normalTheme(c.v(.theme, "white"))
        quietFrom = c.v(.quietFrom, "22:00"); quietTo = c.v(.quietTo, "07:00"); lead = c.v(.lead, 10); wallyQuiet = c.v(.wallyQuiet, false)
    }
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
    var treats: [Treat] = []
    var habits: [Habit] = []
    var restDays: [String] = []
    var draft: [Entry] = []                       // workout in progress, autosaved
    var body: [BodyEntry] = []
    var hideBody = false
    var reflections: [String: Reflection] = [:]
    var challenge: Challenge? = nil
    var inventory: [InvItem] = []
    var shopExtra: [ShopItem] = []
    var shopRemoved: [String] = []
    var events: [CalEvent] = []
    var routines: [Routine] = []
    var wally: [WallyNote] = []
    var blockStart = ""
    var favs: [String] = []
    var shopQty: [String: Double] = [:]
    var skipped: [String] = []
    var draftStart: Date? = nil
    var draftRoutine: String? = nil
    var previewAnims = false
    /// Personalisation round this data has been through. 0 = data from before build 29, 3 = answered the personalisation setup.
    var personalizationVersion = 0
    /// Days softened by a Bad check-in, and the plan as it stood before, so a changed answer can restore it.
    var lightDays: [String] = []
    var planBackup: [String: [String: String]] = [:]
    /// day -> meal -> fraction eaten (0.25, 0.5, 0.75, 1.0). A meal in `eaten` with no entry counts as 1.0.
    var portions: [String: [String: Double]] = [:]
    /// Machine id -> photo file name in Application Support. The app never recognises a machine from a photo.
    var machinePhotos: [String: String] = [:]
    var language = "en"
    /// Firebase uid this saved state belongs to. A different signed-in user never inherits it.
    var ownerUid = ""
    /// Day -> hours slept, and day -> steps. Typed in by the user.
    var sleep: [String: Double] = [:]
    var steps: [String: Int] = [:]

    init() {}
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        onboarded = c.v(.onboarded, false); profile = c.v(.profile, Profile()); water = c.v(.water, [:])
        plan = c.v(.plan, [:]); eaten = c.v(.eaten, [:]); checkins = c.v(.checkins, [:]); routine = c.v(.routine, [:])
        tasks = c.v(.tasks, []); meds = c.v(.meds, []); medLogs = c.v(.medLogs, []); appts = c.v(.appts, [])
        workouts = c.v(.workouts, []); groceryChecked = c.v(.groceryChecked, []); settings = c.v(.settings, Settings())
        treats = c.v(.treats, []); habits = c.v(.habits, []); restDays = c.v(.restDays, []); body = c.v(.body, [])
        draft = c.v(.draft, []); hideBody = c.v(.hideBody, false); reflections = c.v(.reflections, [:]); challenge = try? c.decodeIfPresent(Challenge.self, forKey: .challenge)
        inventory = c.v(.inventory, []); shopExtra = c.v(.shopExtra, []); shopRemoved = c.v(.shopRemoved, []); events = c.v(.events, [])
        routines = c.v(.routines, []); wally = c.v(.wally, []); blockStart = c.v(.blockStart, "")
        favs = c.v(.favs, []); shopQty = c.v(.shopQty, [:]); skipped = c.v(.skipped, []); draftStart = try? c.decodeIfPresent(Date.self, forKey: .draftStart)
        draftRoutine = try? c.decodeIfPresent(String.self, forKey: .draftRoutine); previewAnims = c.v(.previewAnims, false)
        personalizationVersion = c.v(.personalizationVersion, 0); lightDays = c.v(.lightDays, []); planBackup = c.v(.planBackup, [:])
        portions = c.v(.portions, [:]); machinePhotos = c.v(.machinePhotos, [:]); language = c.v(.language, "en")
        ownerUid = c.v(.ownerUid, ""); sleep = c.v(.sleep, [:]); steps = c.v(.steps, [:])
    }
}
extension KeyedDecodingContainer {
    func v<T: Decodable>(_ k: Key, _ d: T) -> T { (try? decodeIfPresent(T.self, forKey: k)) ?? d }
}

enum Lists {
    static let goals = ["Lose weight gently", "Build muscle", "Get stronger", "Feel fitter", "Eat more regularly", "Keep track of my doses"]
    static let goalIcons = ["scalemass", "figure.strengthtraining.traditional", "dumbbell", "figure.run", "fork.knife", "pills"]
    static let goalIds = ["lose", "muscle", "strength", "fitter", "eat", "doses"]
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
    static let checkins = [("bad", "Bad", "Lighter meals and an easier workout are set for today."), ("ok", "Ok", "Your normal plan, as it is."), ("great", "Great", "Full plan, plus one optional extra.")]
    static let checkinIcons = ["bad": "cloud.rain", "ok": "face.smiling", "great": "sun.max.fill"]
}

final class Catalog {
    static let shared = Catalog()
    let recipes: [Recipe]
    let exercises: [Exercise]
    struct Machine: Codable, Identifiable, Hashable { let id: String; let name: String; let exerciseIds: [String] }
    struct Ingredients: Codable { let common: [String]; let all: [String] }
    let machines: [Machine]
    let ingredients: Ingredients
    struct Nut: Codable { let p: Double; let c: Double; let f: Double; let k: Double; let u: [String: Double] }
    struct HelpRec: Codable { let t: String; let i: String; let s: [String]; let c: String }
    let macros: [String: [Int]]
    let nutrition: [String: Nut]
    let help: [String: HelpRec]
    private let byId: [String: Recipe]
    private let exById: [String: Exercise]
    init() {
        let spanish = Locale.preferredLanguages.first?.hasPrefix("es") ?? false
        func loadFile<T: Decodable>(_ name: String, _ type: T.Type) -> T? {
            guard let url = Bundle.main.url(forResource: name, withExtension: "json"),
                  let d = try? Data(contentsOf: url) else { return nil }
            return try? JSONDecoder().decode(T.self, from: d)
        }
        func load<T: Decodable>(_ name: String, _ type: T.Type) -> T? {
            if spanish, let v: T = loadFile(name + "-es", type) { return v }
            return loadFile(name, type)
        }
        recipes = load("recipes", [Recipe].self) ?? []
        exercises = load("exercises", [Exercise].self) ?? []
        machines = load("machines", [Machine].self) ?? []
        ingredients = load("ingredients", Ingredients.self) ?? Ingredients(common: [], all: [])
        macros = load("macros", [String: [Int]].self) ?? [:]
        nutrition = load("nutrition", [String: Nut].self) ?? [:]
        help = load("help", [String: HelpRec].self) ?? [:]
        byId = Dictionary(recipes.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        exById = Dictionary(exercises.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
    }
    func recipe(_ id: String) -> Recipe? { byId[id] }
    func exercise(_ id: String) -> Exercise? { exById[id] }
}
