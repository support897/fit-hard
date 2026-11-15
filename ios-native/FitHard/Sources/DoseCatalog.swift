import Foundation

/// The pick list for My Doses (build 37, her word 15 Nov: "lots of options... and
/// option for them to put their own"). A name here is only a name: something the
/// person may already take, made quick to tap instead of type. Nothing in this
/// list is a recommendation — no order of benefit inside a group, no claims, no
/// amounts, no units. Each entry carries only a how-often starting pick (the
/// common label pattern, researched at the desk) and the times that go with it.
/// The person sees both in the Add sheet and can change them before adding.
/// The dose amount is always typed by the person, for every single entry.
struct DoseCatalogItem: Identifiable, Hashable {
    var id: String { name }
    let name: String
    let frequency: String          // one of the Med frequency words: "Once a day" | "Twice a day" | "Weekly" | "As directed"
    let times: [String]            // "HH:mm" starting times that match the frequency
}

struct DoseCatalogGroup: Identifiable {
    var id: String { title }
    let title: String
    let items: [DoseCatalogItem]
}

enum DoseCatalog {
    private static func d(_ name: String) -> DoseCatalogItem { DoseCatalogItem(name: name, frequency: "Once a day", times: ["08:00"]) }
    private static func n(_ name: String) -> DoseCatalogItem { DoseCatalogItem(name: name, frequency: "Once a day", times: ["21:00"]) }
    private static func t(_ name: String) -> DoseCatalogItem { DoseCatalogItem(name: name, frequency: "Twice a day", times: ["08:00", "20:00"]) }
    private static func w(_ name: String) -> DoseCatalogItem { DoseCatalogItem(name: name, frequency: "Weekly", times: ["08:00"]) }
    private static func a(_ name: String) -> DoseCatalogItem { DoseCatalogItem(name: name, frequency: "As directed", times: ["08:00"]) }

    static let groups: [DoseCatalogGroup] = [
        DoseCatalogGroup(title: "Weekly injections", items: [
            w("Mounjaro"), w("Ozempic"), w("Wegovy"), w("Zepbound"), w("Trulicity"), d("Saxenda"),
        ]),
        DoseCatalogGroup(title: "Peptides", items: [
            d("BPC-157"), d("TB-500"), d("CJC-1295"), d("Ipamorelin"), d("Sermorelin"),
            d("GHK-Cu"), d("Tesamorelin"), w("MOTS-c"), a("PT-141"), a("Melanotan 2"),
        ]),
        DoseCatalogGroup(title: "Vitamins", items: [
            d("Multivitamin"), d("Vitamin D"), d("Vitamin C"), d("Vitamin B12"), d("Vitamin B complex"),
            d("Vitamin A"), d("Vitamin E"), d("Vitamin K"), d("Folic acid"), d("Biotin"),
        ]),
        DoseCatalogGroup(title: "Minerals", items: [
            n("Magnesium"), d("Zinc"), d("Iron"), d("Calcium"), d("Potassium"), d("Selenium"),
        ]),
        DoseCatalogGroup(title: "Oils and omegas", items: [
            t("Fish oil"), t("Omega 3"), d("Krill oil"), d("Cod liver oil"), d("Evening primrose oil"), d("Flaxseed oil"),
        ]),
        DoseCatalogGroup(title: "Training", items: [
            d("Creatine"), d("Protein powder"), d("Pre workout"), d("BCAAs"), d("Electrolytes"),
            d("Collagen"), d("Beta alanine"), d("Citrulline"),
        ]),
        DoseCatalogGroup(title: "Night time", items: [
            n("Melatonin"), n("Ashwagandha"), n("L-theanine"), n("Valerian"), n("GABA"), n("Glycine"),
        ]),
        DoseCatalogGroup(title: "Gut", items: [
            d("Probiotics"), d("Prebiotics"), t("Digestive enzymes"), d("Psyllium husk"), d("Ginger"),
        ]),
        DoseCatalogGroup(title: "Joints and bones", items: [
            d("Glucosamine"), d("Chondroitin"), d("Turmeric"), d("MSM"), d("Hyaluronic acid"),
        ]),
        DoseCatalogGroup(title: "More common ones", items: [
            d("Coenzyme Q10"), t("Berberine"), d("Apple cider vinegar"), d("Spirulina"),
            d("Chlorophyll"), d("Milk thistle"), d("NAC"), d("Quercetin"),
        ]),
    ]

    static var all: [DoseCatalogItem] { groups.flatMap { $0.items } }
}
