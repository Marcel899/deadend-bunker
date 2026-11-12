/* What survivors say in their speech bubbles (js/ui/actors.js picks a topic, then a line).
 * Lines are short on purpose: a bubble shows for a few seconds over a small character. Each topic is
 * a shuffled bag that is saved in the browser: every line is said once before any comes round again.
 * Topics:
 *   needs       hurt, starving, hungry, tired, thirsty (the bunker's water), foodlow, dark (no power)
 *   work        one per room type (or a fallback 'work'); 'build' and 'almost' while a room goes up
 *   activities  eat, sleep (going to bed), rest, heal, mine, idle, lift (waiting for the elevator)
 *   moments     wave (horde coming), won, breach, rain, snow, newbie (a newcomer arrives)
 *   banter      chat (quips and nods to old zombie stories), jokes ('setup|punchline': one survivor
 *               asks, someone standing nearby answers) */
var DE = globalThis.DE = globalThis.DE || {};
DE.Data = DE.Data || {};

DE.Data.SPEECH = {
  /* ---- needs ---- */
  hurt: ['Ow... I need a medic.', 'That really hurts.', 'Somebody patch me up?', 'I\'m bleeding here!', 'Is that supposed to bend?', 'Just a scratch. A big one.',
    'Ouch, ouch, ouch.', 'I\'ll walk it off. Slowly.', 'Got any bandages?', 'Seeing stars over here.', 'My leg says no.', 'Medic! Anyone?'],
  starving: ['I\'m starving!', 'When do we eat?', 'My stomach is growling.', 'I could eat a whole can of beans.', 'Food. Now. Please.', 'I\'d eat a boot right now.',
    'Is that soup I smell?', 'So hungry I can\'t think.', 'Feed me before I bite someone.', 'Even mushrooms sound good.', 'My belly is louder than the zombies.', 'Rations, anyone?'],
  hungry: ['Getting peckish...', 'Lunch soon?', 'Is there anything to eat?', 'Could go for a snack.', 'What\'s for dinner?', 'Saving room for soup.',
    'Is it meal time yet?', 'A cracker would be nice.', 'My tummy is rumbling.'],
  tired: ['I need some sleep.', 'Can barely keep my eyes open...', 'So... tired...', 'Five more minutes of sleep, please.', 'Is it bedtime yet?', 'I\'m running on fumes.',
    'Somebody take my shift.', 'Zzz... huh? I\'m awake!', 'Need. Coffee.', 'My bunk is calling me.', 'Yawn...', 'I could sleep standing up.'],
  thirsty: ['I\'m really thirsty...', 'Is there any water left?', 'My throat is so dry.', 'We need more water!', 'Just one sip, please.', 'I\'d trade my boots for water.',
    'The tank sounds empty.', 'Dry as a desert down here.', 'Someone check the purifier!', 'Water... please...', 'My lips are cracking.', 'Even rainwater would do.'],
  foodlow: ['The pantry is almost empty.', 'Rations are getting thin.', 'We need more food down here.', 'Last few cans left.', 'Who\'s on farm duty?', 'Half portions again?',
    'The shelves are bare.', 'We should plant more.'],
  dark: ['Who turned off the lights?', 'The power keeps dropping!', 'I can\'t see a thing.', 'Flashlight, anyone?', 'The generator is choking!', 'Lights flickering again...',
    'It\'s spooky in the dark.', 'We need more power!'],

  /* ---- work, per room ---- */
  work: ['Back to work.', 'Another day, another shift.', 'Keeping busy!', 'All good here.', 'On it!', 'Nothing beats honest work.', 'Almost done with this bit.',
    'Busy, busy, busy.', 'Let\'s get this done.', 'Whistle while you work!'],
  farm: ['Fresh food!', 'These tomatoes look great.', 'Growing nicely.', 'Harvest time!', 'Mind the seedlings.', 'Come on, little sprouts.', 'Who ate my carrot?',
    'Water, light, love.', 'Dirt under my nails again.', 'Best potatoes in the bunker.', 'The beans are up!', 'I talk to the plants. It helps.'],
  hydroponics: ['Fresh food!', 'The roots love this stuff.', 'Lettuce, anyone?', 'No soil, no problem.', 'Nutrients at 100%.', 'These grow like crazy.', 'Bubbles and basil.'],
  greenhouse: ['Fresh food!', 'Real sunlight, almost.', 'The beans are climbing!', 'Smells like summer in here.', 'Strawberries soon!', 'Watch the glass.'],
  mushroom: ['Mushrooms, again.', 'It smells earthy in here.', 'Fresh food!', 'They grow in the dark. Like us.', 'Fungi are fun guys.', 'Spores everywhere.'],
  water: ['Clean water, coming up.', 'Filters need changing...', 'Drip, drip, drip.', 'Crystal clear!', 'Pressure looks good.', 'Purest water in town.',
    'Don\'t drink from that tank.', 'Gurgle gurgle.', 'Another filter, another day.', 'Flowing nicely!'],
  aquifer: ['Clean water, coming up.', 'Plenty of water today.', 'Deep, cold and clean.', 'Listen to it rush!', 'We\'ll never go thirsty.'],
  condenser: ['Water from thin air!', 'Clean water, coming up.', 'Every drop counts.', 'Cold coils, wet walls.'],
  generator: ['Power\'s holding steady.', 'Keep that engine humming.', 'Lights stay on today.', 'Smells like diesel.', 'Who left oil on the floor?', 'She purrs like a kitten.',
    'More fuel, more power.', 'Don\'t touch the red wire.', 'Volts looking good!', 'Rumble, rumble.'],
  solar: ['Sunshine, bottled.', 'Power\'s holding steady.', 'Clean energy!', 'Wipe the panels, please.', 'The sun works for us now.'],
  workshop: ['More scrap for the pile!', 'Hand me that wrench.', 'Good as new.', 'Measure twice, cut once.', 'Where\'s my hammer?', 'Grinding away.',
    'This used to be a toaster.', 'One bolt short...', 'Fixed it! Mostly.', 'Duct tape saves lives.', 'Sparks flying!'],
  smelter: ['Hot work today!', 'Fresh ingots!', 'Mind the sparks.', 'Pour it slowly...', 'It\'s an oven in here.', 'Molten metal, coming through!'],
  lab: ['Fascinating...', 'I think I\'m onto something!', 'Eureka!', 'Don\'t touch that beaker.', 'The data doesn\'t lie.', 'Hypothesis: confirmed!',
    'Hmm, that\'s not right.', 'Pass the microscope.', 'Science never sleeps.', 'This changes everything!', 'Who labelled this "maybe"?'],
  medbay: ['Hold still, this will sting.', 'Deep breaths.', 'You\'ll be fine.', 'Say "ahh".', 'Next patient!', 'Wash your hands, people.', 'Bandages are running low.', 'Nothing a stitch won\'t fix.'],
  infirmary: ['Hold still, this will sting.', 'Rest up, you hear?', 'Temperature is normal.', 'Doctor\'s orders: sleep.', 'Fluids and rest.'],
  hospital: ['Next patient!', 'Scalpel, please.', 'Vitals are stable.', 'Keep the corridor clear!'],
  quarantine: ['Keep your distance.', 'Masks on, everyone.', 'Nobody in, nobody out.', 'Checking for symptoms...'],
  kitchen: ['Soup\'s on!', 'Who used all the salt?', 'Smells good, right?', 'Secret recipe!', 'Don\'t burn the beans!', 'Chop, chop, chop.', 'Taste this!'],
  cafeteria: ['Grab a tray!', 'Soup\'s hot today.', 'One scoop each, folks.', 'Line up, line up!'],
  radio: ['Is anyone out there?', 'Static again...', 'I heard voices on 7-4!', 'Calling all survivors...', 'This is Dead End, over.', 'Just music. Old music.'],
  comms: ['Is anyone out there?', 'Signal\'s weak today.', 'Patching you through...', 'Encrypted chatter. Interesting.'],
  security: ['Cameras all clear.', 'Something moved out there...', 'Eyes on the gate.', 'All quiet on camera three.', 'Was that a raccoon?', 'Watching. Always watching.'],
  armory: ['Locked and loaded.', 'Clean guns save lives.', 'Count the rounds twice.', 'Oil, rag, repeat.', 'Safety on, people!'],
  barracks: ['Ready for duty.', 'Polish those boots!', 'Drills at dawn.'],
  storage: ['Everything in its place.', 'Who left this crate here?', 'Inventory checks out.', 'Stack it higher!', 'Label your boxes, people!'],
  concrete: ['Mixing another batch.', 'Heavy stuff, this.', 'Don\'t let it set!', 'Gravel, sand, water, done.'],
  fuel: ['Careful with that fuel!', 'Smells flammable.', 'No smoking in here!', 'Full tanks today.'],
  minehead: ['Next shift, down you go.', 'Check the hoist cables.', 'Ore cart\'s full!', 'Helmets on!'],
  build: ['Hammer time!', 'Hold that beam steady!', 'Coming along nicely.', 'Nail, nail, nail...', 'Pass me the level.', 'Brick by brick.', 'Mind your head!',
    'Who has the blueprints?', 'Straight as an arrow.', 'Building the future!'],
  almost: ['Almost finished!', 'Just a few more bolts!', 'Nearly done!', 'Last touches!', 'One more beam!', 'Painting the trim!', 'Ready in a moment!', 'Final screw...'],

  /* ---- activities ---- */
  eat: ['Mmm, hot soup!', 'Pass the salt.', 'Best meal all week.', 'Tastes like home.', 'Fresh food!', 'Seconds, please!', 'Who cooked? It\'s great!', 'Beans again. Love it.',
    'Save me the crust.', 'Yum!', 'Don\'t talk with your mouth full.', 'This hits the spot.', 'My compliments to the chef.'],
  sleep: ['Goodnight, everyone.', 'Time for some shut-eye.', 'Wake me if they come.', 'Off to bed.', 'Sweet dreams, bunker.', 'Lights out for me.', 'Finally, my bunk!', 'See you at sunrise.'],
  rest: ['I miss pizza.', 'Remember sunshine?', 'Did you hear that noise last night?', 'Just a quick break.', 'Anyone up for cards?', 'I miss the beach.',
    'What day is it?', 'I had a dream about ice cream.', 'We should start a band.', 'Who snores so loud?', 'I used to be an accountant.', 'Tell me a joke.',
    'My feet hurt.', 'I could use a vacation.', 'Wanna arm wrestle?', 'I still have my library card.'],
  heal: ['Feeling better already.', 'Just need some rest.', 'The medic says I\'ll live.', 'Getting stronger.', 'Thanks for the care.', 'Bed rest is boring.'],
  mine: ['Solid rock down here!', 'Watch out, loose rocks!', 'Dig, dig, dig...', 'Found something shiny!', 'This rock won\'t budge!', 'Deeper and deeper.',
    'My arms are on fire!', 'Is that a fossil?', 'Hard hats save heads.', 'Clear the rubble!', 'Pickaxe needs sharpening.', 'Hear that echo?', 'Rocks, rocks and more rocks.'],
  idle: ['Anything I can do?', 'I\'m bored...', 'Put me to work!', 'Where do you need me?', 'Twiddling my thumbs here.', 'Got a job for me?', 'I can fix stuff!', 'Idle hands...'],
  lift: ['Come on, lift...', 'Going down?', 'Slowest elevator ever.', 'Hold the door!', 'Taking the stairs next time.', 'Ding! Finally.'],

  /* ---- moments ---- */
  wave: ['Here they come!', 'Zombies at the gate!', 'Get to your posts!', 'I hear them...', 'Brace yourselves!', 'Lock the hatch!', 'Guards, get ready!', 'They\'re coming back!'],
  won: ['We held them off!', 'Not today, zombies!', 'That\'s how it\'s done!', 'Victory!', 'Is that all you\'ve got?', 'The wall held!', 'Good work, team!'],
  breach: ['They\'re inside!', 'They got in!', 'Hold the corridor!', 'Barricade the doors!', 'Everyone, fall back!', 'Protect the kids!'],
  rain: ['Hear that rain on the hatch?', 'Good day for the water tanks.', 'Rain, rain, go away.', 'Smell that? Fresh rain!', 'The pipes are singing.'],
  snow: ['Brr, it\'s cold up there.', 'Snow again...', 'Anyone seen my gloves?', 'Winter is here.', 'Snowball fight later?'],
  /* ---- banter ---- */
  chat: ['Remember when the worst thing was traffic?', 'I used to complain about Mondays.', 'Zombies: people with bad time management.',
    'I\'d tell a zombie joke, but it\'s dead.', 'Day 400. Still no pizza delivery.', 'My plants have names. Don\'t judge.', 'Who keeps stealing my socks?',
    'I bet the zombies miss coffee too.', 'If a zombie bites a vampire, who wins?', 'I\'ve read every book down here. Twice.', 'Note to self: never go outside barefoot.',
    'Somebody hum something. It\'s too quiet.', 'We should paint the walls. Bunker beige is sad.', 'I named the rat Gerald.',
    // nods to the zombie stories everybody watched before the end
    'Anyone seen a sheriff on a horse?', 'Never go into a barn. Trust me on this.', 'Found a giant can of pudding once. Best day ever.',
    'A safe place at the end of the tracks? Sounds like a trap.', 'If anyone offers us a "sanctuary", we run.', 'Never trust a guy with a bat and a big grin.',
    'A guy with a crossbow would be handy right now.', 'Meet a lady with a sword? Be very, very polite.', 'A prison sounds cozy, honestly.',
    'Hiding in a tank in the middle of town? Rookie mistake.', 'If I grow a prophet beard, somebody cut it.', 'At least we\'re not stuck in a CDC building.',
    'Never trust a man who calls himself Governor.', 'People wearing faces? No thanks. Whisper and I run.', 'Somebody keeps shouting a kid\'s name in my dreams.',
    'Rule one: aim for the head.', 'Don\'t name the walkers. It only makes it harder.'],
  jokes: ['Why don\'t zombies eat clowns?|Because they taste funny!', 'What\'s a zombie\'s favourite day?|Chewsday!', 'Why did the zombie skip school?|He felt rotten.',
    'How do zombies stay fit?|Dead-lifts!', 'What\'s a zombie\'s favourite bean?|A human bean.', 'Why are zombies bad at hide and seek?|They always go to pieces.',
    'What does a vegan zombie eat?|Graaaains!', 'Why did the zombie cross the road?|To eat the chicken.', 'What do you call a zombie comedian?|A dead-pan!',
    'Why do zombies lose every argument?|They lose their heads.', 'What did the zombie get for his birthday?|A no-brainer.', 'Why don\'t zombies like fast food?|They can\'t catch it.',
    'What\'s a zombie\'s favourite game?|Hide and go shriek!', 'Why was the zombie so calm?|Nothing gets under his skin. Nothing\'s left.',
    'How does a zombie say hello?|"Pleased to eat you!"', 'What do zombies put on their salad?|Grated brains... I mean cheese.', 'Why did the zombie get a job?|He wanted a living wage.',
    'What\'s a zombie\'s favourite music?|Anything with a lot of soul.', 'What do zombies order at a bar?|A Bloody Mary, hold the Mary.', 'Why are zombies so good at chess?|They always go for the head.'],
  newbie: ['Hello, everyone!', 'Thanks for taking me in.', 'Nice place you\'ve got.', 'Where do I sleep?', 'Hi! I\'m new here.', 'Finally, people!', 'I can pull my weight.', 'Is it always this loud?'],
};
