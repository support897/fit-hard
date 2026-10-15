"use strict";
/* Fit App data. Areas, setup choices, colours.
   Recipe + nutrition data arrive in Phase 2, vendored from Meal Prep.
   Exercise data arrives in Phase 4 from a public domain source,
   rewritten in our own words and credited there. */
window.FIT_DATA = (function () {
  var AREAS = [
    { id: "peptides", label: "Peptides", color: "#52695A", soft: "#E4EBDD",
      subs: [
        { id: "pep-list", label: "My peptides" },
        { id: "pep-log", label: "Dose log" },
        { id: "pep-next", label: "Next doses" }
      ] },
    { id: "meals", label: "Meals", color: "#52695A", soft: "#DCE7D8",
      subs: [
        { id: "meal-plan", label: "Meal plan" },
        { id: "meal-recipes", label: "Recipes" },
        { id: "meal-fridge", label: "Fridge photo" },
        { id: "meal-treats", label: "Treats" },
        { id: "meal-groceries", label: "Groceries" }
      ] },
    { id: "gym", label: "Gym", color: "#52695A", soft: "#D5E2D2",
      subs: [
        { id: "gym-routines", label: "Routines" },
        { id: "gym-session", label: "Session" },
        { id: "gym-machine", label: "Machine photo" }
      ] },
    { id: "calendar", label: "Calendar", color: "#52695A", soft: "#EAF0E2",
      subs: [
        { id: "cal-month", label: "Month" },
        { id: "cal-habits", label: "Habits" },
        { id: "cal-todos", label: "To do list" }
      ] }
  ];
  /* What-they-need picker in setup. Each need lights up one area;
     calories is a meals feature, so it maps to meals. */
  var NEEDS = [
    { id: "meals", label: "Meal plans", area: "meals" },
    { id: "calories", label: "Calorie counts", area: "meals" },
    { id: "gym", label: "Gym routines", area: "gym" },
    { id: "peptides", label: "Peptide tracking", area: "peptides" },
    { id: "calendar", label: "Calendar and habits", area: "calendar" }
  ];
  var CUISINES = ["Mexican", "Greek", "Mediterranean", "Italian", "Asian",
    "Indian", "American", "Australian", "Healthy", "Comfort", "Quick"];
  var GOALS = ["Lose weight gently", "Build strength", "Feel fitter",
    "Eat more regularly", "Keep track of my doses"];
  /* One colour per peptide, picked in order, never repeated. */
  /* Muted Burrow-family palette: every peptide still gets its
     OWN colour, drawn from the one calm sage + earth family. */
  var PEPTIDE_COLORS = ["#52695A", "#AC9278", "#7A8B6F", "#8A6D4F",
    "#6B7F8C", "#97795D", "#5D7263", "#B08968"];
  var CHECKINS = [
    { id: "bad", label: "Bad", hint: "A softer day is planned for you." },
    { id: "ok", label: "Ok", hint: "Your normal plan, as it is." },
    { id: "great", label: "Great", hint: "Full plan, plus one optional extra." }
  ];
  var DISCLAIMER_VERSION = 1;
  var DISCLAIMER_TEXT = "This app is not a doctor and gives no medical advice. " +
    "It only tracks what you and your doctor have already decided. " +
    "If you feel unwell, talk to your doctor or get urgent help.";
  return { AREAS: AREAS, NEEDS: NEEDS, CUISINES: CUISINES, GOALS: GOALS,
    PEPTIDE_COLORS: PEPTIDE_COLORS, CHECKINS: CHECKINS,
    DISCLAIMER_VERSION: DISCLAIMER_VERSION, DISCLAIMER_TEXT: DISCLAIMER_TEXT };
})();
