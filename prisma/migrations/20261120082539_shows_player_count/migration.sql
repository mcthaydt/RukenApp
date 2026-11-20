-- The maker's choice to show on a game's page how many people played it this week. Off for every game until its maker turns it on.

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "showsPlayerCount" BOOLEAN NOT NULL DEFAULT false;
