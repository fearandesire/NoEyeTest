# How To Use

### Important
- [Worker Console](WorkerConsole.js) is intended to be used *before* you run progs.
  - You can use WorkerConsole at any time, but you *must* run them before progs each season.
  - Ideally, run [worker console code](WorkerConsole.js) in the Off-season Free Agency
- **Only players who are 25 y/o and older are affected** - they should be 26 after 'Progs' and this is the target age we want to affect.

### Age Tierlist
Review the age tierlist along with how low and high a player can go in each tierlist **[here](tiers.md)**

## Instructions 📓

### Flag Players 🚩

1. Copy the code for the [Worker Console](WorkerConsole.js)
2. Paste and run in BBGM's Worker Console to flag eligible players. This will 'flag' players (25+ y/o) for the script

### Run the Prog Script 🏃‍♂️

3. Sim to the preseason (aka `progs`)
4. Now copy the code for the Prog Script from [NoEyeTest](NoEyeTest.js)
5. Paste and run in BBGM Worker Console
6. Done! 👏

You can view the specifics of who progged, god progged (from the prog script), etc by viewing the `News Feed` inside of BBGM. This is where all Prog Script information will be logged.

## Additional Information



This Prog Script currently includes features that are intended to assist with balancing Leagues.

- Players who are 30 and above have an extremely low chance (<5%) to prog 'Physical' skills
- Players under 30 have a 9% chance to God Prog. The closer they are to 30, the lesser their chance
- Players cannot progress above 80 overall
- There are **hard caps** for each age groups prog ranges - restricting how high and how low players can go as they age

## :book: About

**NoEyeTest** is a script designed for the browser-game: [BBGM](http://www.basketball-gm.com); The intention the script is to create a realistic progression system by using simple formulas based on player's PER stat for the last season

## :question: Why was this made?

By default in BBGM, at the age of 26, a player will have a great chance to regress that only gets higher and worse the more they age; Within one off-season, an elite player(s) on your team could be devastatingly weakened or some players that should be hitting their prime, do not. The motive behind this is to enable a system that reasonably progresses players while not being based on random chance. This prog script is especially beneficial to multiplayer BBGM leagues, which, if you are familiar with, you know how critical progs are for a team.

### :brain: Logic Behind the Script

By taking into account the player's PER:

- We create a reference point for you to be informed of the potential 'Prog Range' of your player.
- There's nothing wrong with the progression system by default in BBGM - and it works wel for the casual player. This is intended for multiplayer Leagues, or users who would like to try out a more realistic approach. This prog script instills confidence in knowing your player will progress based on their performance. This means your all-star player who is coming off an amazing season, 19.50 PER will have a great chance to prog well, instead of randomly going -7.

# Todo

Nothing planned currently!

#### Credits

The idea and certain elements are created by TheProgMaestro
