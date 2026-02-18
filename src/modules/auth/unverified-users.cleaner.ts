import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AuthRepository } from './auth.repository';
import { UNVERIFIED_ACCOUNT_DELETE_AFTER_MS } from './auth.constants';

/**
 * Cleaner: runs daily and deletes unverified users older than 24 hours.
 */
@Injectable()
export class UnverifiedUsersCleaner {
  private readonly logger = new Logger(UnverifiedUsersCleaner.name);

  constructor(private readonly authRepository: AuthRepository) {}

  @Cron('0 3 * * *')
  async handleCleanup() {
    const before = new Date(Date.now() - UNVERIFIED_ACCOUNT_DELETE_AFTER_MS);
    try {
      const deleted =
        await this.authRepository.deleteUnverifiedUsersOlderThan(before);
      if (deleted > 0) {
        this.logger.log(
          `Unverified users cleaner: deleted ${deleted} account(s) older than 24 hours.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Unverified users cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
