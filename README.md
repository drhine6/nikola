### Nikola

Nikola is a Fantasy Basketball AI assistant coach.

His responsibilities are:

- Check beat reporters twitter (X) periodically and before for any injury updates or reports that would affect players' minutes
- Check the league activity for add/drops
- monitor weekly game limits to
- Create weekly lineup that optimize for the best players playing maximum number games and playing as many games in the matchup as possible (see restriction 1)

Technologies used

- [ESPN API](https://github.com/cwendt94/espn-api/)
- Framework: Tanstack start (Dashboard)
- Backend + Cron Jobs: Convex
- Telegram: Send alerts to head coach

Restrictions:

- Each team can only make 7 acquisitions (add/drops or trades) per week
- Each team can only play 25 games per week. The optimal strategy is to get to 24/25 games on a single day then the next day play as many games as possible. Given that there are 7 player slots, the theoretical game limit is 24 + 7 = 31
