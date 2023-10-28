# Prog Script Age Tierlist
This tierlist covers the different age brackets the prog script affects as well as the specific ceilings and equations for each player.

**DEXTER** will show you the current `Prog Range` for a player if you use the `/p` or `/stats` command depending on your UI settings.

## **KEY:**
- **Hard Max** refers to the *highest* value a player will progress
- **Hard Min** enforces the *lowest* value a player will **regress**.
- **Low** & **High** refer to the [Lowest, Highest] a player can progress for their 'Prog Range'.
- A `Prog Range` is the 'range' a player has for progs this season. The first number is the lowest, and the secon is the highest
- All ranges are rounded up

### 25-30
**Hard Max: 4**

Math:
- **If PER <= 20 & age < 31:**
  - Low:  (per / 5) - 6
  - High:  (per / 4) - 1
- **Otherwise:**
  - Low: (per / 5) - 7
  - High: (per / 4) - 2

### 31-34
**Hard Max: 2**

Math:
- Low: (per / 6) - 7
- High: (per / 4) - 3

### 35+
**Hard Max: 0**

Math:
- Low: (per / 6) - 9
- High: 0

## **80+ ovr**
**Hard Max:** 0

### <= 30
**Hard Min:** Between 0 and -2 (Random)

### 31-34
**Hard Min:** -10

### 35+
**Hard Min:** -14
