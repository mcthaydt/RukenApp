-- Social icons on a maker's page (feed-and-makers-page spec, unit K). Only adds: Postgres cannot drop an enum value.
ALTER TYPE "PageLinkKind" ADD VALUE 'social';
