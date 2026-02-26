import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("syncLeague", { hours: 6 }, internal.sync.runSyncLeague, {});

crons.interval("syncLive", { minutes: 10 }, internal.sync.runSyncLive, {});

crons.daily("syncSchedule", { hourUTC: 12, minuteUTC: 0 }, internal.sync.runSyncSchedule, {});

export default crons;
