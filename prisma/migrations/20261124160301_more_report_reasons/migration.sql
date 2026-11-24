-- Two more report reasons (two-more-report-reasons spec). Only adds: Postgres cannot drop an enum value.
ALTER TYPE "ReportReason" ADD VALUE 'violence';
ALTER TYPE "ReportReason" ADD VALUE 'scam';
