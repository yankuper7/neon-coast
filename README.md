# Neon Coast 🌴

An original open-world browser game seen from above: a tropical coastal city with neon lights, driving, police and missions.
It is inspired by open-world crime-and-driving games, but the city, names and characters are original.

## How to open
Double-click `index.html`. Nothing to install, no internet needed. Works on desktop and on phones and tablets.

## What is in the game
- A whole city: a downtown with towers, a beach strip, a market, a suburb, a port, a park and swamps
- Eight kinds of cars, traffic that obeys traffic lights, signals before turning and drives around obstacles
- Pedestrians who wait for the green light, open umbrellas in the rain, jog, and jump out of the way of a horn
- Police with up to 5 stars: line of sight, search of your last known position, officers on foot,
  roadblocks and a helicopter at four stars, and spray shops that clear the stars
- 10 story missions from four contacts (several can be open at once): taxi fares, a car delivery, tailing a truck,
  a checkpoint race, a demolition job, a police escape, a race against rivals and more
- Side jobs you can repeat: endless taxi fares (press T in a taxi) and three time trials with medals
- 15 hidden golden flamingo statues
- Day and night with moving sun shadows, coloured street and neon lighting, lit windows, headlights
- Weather: clear, cloudy, rain, storms with lightning, and fog. Wet roads are slippery
- Particles: smoke, fire, sparks, dust, splashes, debris, confetti
- Sound made entirely in code: an engine with gears, sirens, a helicopter, sea, rain, wind, birds, crickets,
  and four radio stations plus a menu theme
- Automatic saving in the browser: money, missions, flamingos, records, statistics, your position, your car,
  the time of day and the weather. Saves from the earlier version are converted automatically

## Controls
- **On foot:** arrow keys or WASD, Shift to run, E to get into a car
- **In a car:** ↑ gas, ↓ brake and reverse, ← → steer, Space handbrake, E exit, H horn, R radio, T taxi fares
- **General:** P or Esc for pause and the map, M to mute
- **Phone and tablet:** drag a finger anywhere like a joystick – the car drives where you point.
  Buttons: 🚗 in and out, DRIFT handbrake, 📣 horn. A pedals layout is available in Settings
- **Gamepad:** left stick, RT gas, LT brake, A in and out, B handbrake, X horn, Y action, Start pause

## Settings
Volume for master, music and effects · graphics quality (Auto adapts to the device) · camera shake · FPS counter ·
difficulty (Easy, Normal, Hard) · touch layout · vibration · fullscreen · erase the saved game.

## Files
- `index.html`, `style.css` – structure and styling of the menus and the HUD
- `js/util.js` – shared helpers and settings
- `js/map.js` – city generation, traffic lights, line of sight, road distances
- `js/audio.js` – sound effects, ambience and music
- `js/weather.js` – weather states and transitions
- `js/fx.js` – particle effects
- `js/world.js` – cars, physics, pedestrians, traffic and police
- `js/missions.js` – story missions, side jobs, flamingos, spray shops, hospital
- `js/render.js` – drawing: cached ground, shadows, lighting, weather, buildings, radar
- `js/main.js` – input (keyboard, touch, gamepad), interface, saving and the game loop
- `backup-before-upgrade/` – a copy of the game as it was before version 2.0
- `hebrew-backup/` – a copy of the earlier Hebrew version
