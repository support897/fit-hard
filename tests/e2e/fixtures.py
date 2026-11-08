from harness import *
import datetime
def today_key():
    d = datetime.date.today(); return d.strftime("%Y-%m-%d")

def seeded():
    t = today_key(); wd = (datetime.date.today().isoweekday() % 7)
    return {"profile": {"name": "Sam", "setupDone": True, "needs": ["meals", "gym", "peptides", "calendar"], "weightKg": 70, "heightCm": 170, "age": 35, "formulaSex": "female", "activity": "some", "deficit": "gentle"},
            "routines": [{"id": "r1", "name": "Full body", "days": [wd], "time": "18:00", "createdKey": "2026-01-01", "items": [{"exerciseId": "Leg_Press", "sets": 3, "reps": 10, "restSec": 60}]}],
            "todos": [{"id": "t1", "title": "Buy oats", "date": t, "time": "09:00", "status": "open", "color": "#52695A"}],
            "habits": [{"id": "h1", "name": "Stretch", "color": "#52695A", "days": {}}],
            "peptides": [], "sessions": [], "plan": {}, "checkins": {}, "settings": {"tourSeen": True, "notifications": False, "remindAsked": True}}

