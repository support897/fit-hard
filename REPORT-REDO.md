
---

## Round 2: studio exercise animations (build 40)

What I built
- New drawing engine `app/anim-pro.js`: a studio look in the brand colours (Sage top, Ink shorts, cream shoes, soft cream to mint room). Boy, girl and non binary builds.
- It follows the person's pick in the profile (boy, girl, nonbinary). Change it and the figure changes.
- Plays the real motion tracks (277 exercises). One rep is 4.5 s: hold 1.0, push 1.0, top hold 0.5, lower 2.0. Hip fixed, feet planted.
- Machines, benches, seats, weight stacks, cables and pulleys are drawn around the body, so the gear matches the move.
- In the app: a small web view (`ProAnim.swift`) shows it. Wally coaches with a line, "Rep 1 of 2", the step name, and an equipment label. Tap the picture for full screen. The "?" help sheet shows it too.
- Falls back to the old still pictures if an exercise has no track. Reduce Motion shows one still pose.
- Built with Xcode 27 / iOS 27 SDK on the pinned `xcode-27` runner.

Honest limits
- I never received the Leg Press sample video or the reference pictures, so I matched the written brief and public research (Fitbod and Gymaholic 3D, Freeletics silent loops, Peloton and Apple Fitness+ filmed).
- It is vector motion, not filmed or 3D video.
- 277 of 871 exercises have motion tracks. The other 594 still show stills or icons.
- Each track has only 2 key poses. Accuracy was checked on sample sheets, not all 277 x 3. Some machines are auto-built shapes, not exact brand machines.
- Other screens (Door, Check in, Goals, Talk, Habits, To do, More) still use the build 39 layout.

What I need you to pick
- Whether to commission real filmed or 3D clips for the top 30 lifts.
