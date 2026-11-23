# Fit Hard trainer and nutritionist knowledge

Living file. Update it whenever the app's rules change. Last updated: build 56 (23 Nov 2026).
Plain labels: VERIFIED means read from the source page. JUDGMENT means a product choice made on top of the evidence. Fit Hard gives general fitness information, never medical advice, doses or products.

## 1. Training rules and where they come from

| Rule in the app | Source | Status |
|---|---|---|
| Train every major muscle group at least 2 days a week, high effort, any equipment works. Consistency beats a perfect plan. | ACSM Position Stand 2026, "Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews" (Med Sci Sports Exerc, Apr 2026; 137 reviews, over 30,000 people). PMC12965823, acsm.org news of 17 Mar 2026. | VERIFIED |
| Strength goal: heavier loads (about 80 percent of 1RM or more), 2 to 3 sets per exercise, big lifts first. App: strength gets 4 to 6 reps on barbell and machine lifts, 150 s rest. | ACSM 2026 (same). | VERIFIED rule, rep numbers are JUDGMENT |
| Muscle size goal: about 10 or more hard sets per muscle per week. More sets give more growth up to about 18 to 20 weekly sets, then returns shrink. App starts at 2 to 4 sets per exercise by experience and adds volume with progress. | ACSM 2026; Schoenfeld, Ogborn, Krieger 2017, J Sports Sci 35(11):1073 (34 groups, 15 studies; each extra weekly set about 0.37 percent more growth; 10 plus sets best). | VERIFIED |
| Many loads work for size if sets end close to failure (about 30 to 85 percent 1RM). App uses 6 to 12 reps for gain and muscle goals. | Schoenfeld, Grgic, Van Every, Plotkin 2021, Sports 9(2):32. | VERIFIED |
| Going to total failure is not needed. Stop with a little in reserve, especially on heavy compound lifts. | Refalo et al. 2023, Sports Med 53(3):649 (15 studies; no proof failure beats non failure). ACSM 2026 says the same. | VERIFIED |
| Double progression: when every set reaches the top of the rep range, add a small amount of weight. Pain, unfinished work or max effort block the increase. | Standard practice, supported by progressive overload in ACSM 2026. | JUDGMENT (rules coded in ProgressionEngine) |
| Fat loss and general fitness: lighter loads, 10 to 15 reps, shorter rests (45 s), machines and dumbbells first, a cardio day added. | Any load builds or keeps muscle (Schoenfeld 2021); lower skill and joint load fits people losing weight. | JUDGMENT |
| Plan keeps balance: no more than 5 lifting days, planned rest, mobility day. | Recovery practice. | JUDGMENT |

### Goal map (sign-up)
| Goal id | Name shown | Calories | Protein per kg | Reps | Rest | Exercise tilt |
|---|---|---|---|---|---|---|
| lose | Lose weight | maintenance minus 500, capped at 20 percent, never under the safe floor | 1.8 | 10 to 15 (12 to 15 on small lifts) | 45 s | machines and dumbbells first, cardio day |
| gain | Gain weight | maintenance plus 300 | 1.6 | 6 to 10 compound, 8 to 12 other | 90 s compound | barbell and machine lifts first |
| muscle | Gain muscle | maintenance plus 300 | 1.6 | 6 to 10 compound, 8 to 12 other | 90 s compound | barbell and machine lifts first |
| maintain | Maintain weight | maintenance | 1.4 | 8 to 12 compound, 10 to 15 other | 60 s | machines and dumbbells first |
| strength | Get stronger | maintenance | 1.6 | 4 to 6 compound, 6 to 10 other | 150 s compound | barbell first |
| fitter | Get fitter | maintenance | 1.4 | 10 to 15 | 45 s | machines and dumbbells first, cardio day |
| eat | Eat healthier | maintenance | 1.4 | 8 to 12 | 60 s | balanced |
| doses | Keep track of my doses | maintenance | 1.4 | 8 to 12 | 60 s | balanced |

Changing the goal rebuilds the plan, the routines and the meals (Store.profileChanged).

## 2. Calories and nutrition rules

- Resting energy: Mifflin-St Jeor. Men 10 x kg + 6.25 x cm - 5 x age + 5. Women the same with minus 161. Mifflin MD et al., Am J Clin Nutr 1990;51(2):241-247. VERIFIED.
- Daily need = resting energy x activity factor (1.2 sedentary, 1.375 light, 1.55 moderate, 1.725 active). VERIFIED as the common convention.
- Loss: a 500 to 750 kcal deficit a day is the usual start. Typical floors 1,200 kcal for women and 1,500 kcal for men; under 800 kcal only under medical care. 2013 AHA/ACC/TOS guideline, Jensen et al., Circulation 2014;129(25 Suppl 2):S102. VERIFIED. The app uses 500 (capped at 20 percent) and never goes under the floor or under resting energy, and warns when it raises a target.
- Healthy pace: about 0.5 to 1 kg a week at most. VERIFIED (same guideline, CDC advice of 1 to 2 lb a week).
- Gain: plus 300 kcal a day, a slow lean gain. JUDGMENT.
- Protein: about 1.6 g per kg a day is the point where extra protein stops adding muscle in lifters (95 percent range up to 2.2). Morton et al., Br J Sports Med 2018;52(6):376. Range 1.4 to 2.0 g per kg for people who train: Jager et al., ISSN position stand, J Int Soc Sports Nutr 2017;14:20. VERIFIED. The app keeps protein between 1.4 and 2.0 g per kg. During loss it uses 1.8 to protect muscle (JUDGMENT, inside the ISSN range).
- Spread protein over meals, about 0.25 g per kg or 20 to 40 g a meal (ISSN 2017). VERIFIED.
- Calories from photos and recipes are estimates. The user can correct a food or a portion in one tap.

## 3. Exercises (all 871)
- Every exercise carries its own form cue, muscle part, equipment and level in exercises.json. The cue is the source of truth for form in the app.
- Swap rule (Train screen): same muscle part, same kind (strength, cardio or stretching), equipment the person has, level within one step of the old exercise and allowed for their experience, never one already in the day. Exercises with a video come first.
- Videos: 840 clips. 17 exercises are on a block list and never use a video (barbell and dumbbell shrugs, leverage shrug, the rotations, calf press on the leg press, close grip front lat pulldown, dumbbell lying pronation, seated one leg calf raise, good morning off pins, both muscle ups, on your back quad stretch, rocking standing calf raise, barbell incline shoulder raise). They show the animation or icon.
- Form notes by area (JUDGMENT, general coaching): keep the spine neutral on hinges and squats; shoulders down and back on presses and rows; control the lowering phase (eccentric work helps size, ACSM 2026); full range of motion you can control; no pain through a joint. Stop and rest if it hurts. For any pain, see a professional.

## 4. Recipes
- Each recipe shows every ingredient and every step. One tap changes servings (1 to 12) and the unit system (g and ml, or oz and cups). Conversions: 1 oz = 28.35 g, 1 cup = 240 ml, 1 tbsp = 15 ml, 1 tsp = 5 ml.
- "In plain words": every step rewritten in B2 English. Same steps, same amounts, same order. Only the wording changes. Stored in recipes-human.json.
- Meals follow the goal: lose leans on protein dense meals, gain and muscle raise the calorie and protein target.

## 5. Open items
- A custom domain for the clip host.
- Review the plain words rewrite with a native English reader.
