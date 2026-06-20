import { GoogleWatchRenewalWorker } from './google-watch-renewal.worker';
import { CalendarRepository } from '../repositories/calendar.repository';
import { GoogleCalendarService } from '../services/google-calendar.service';

jest.mock('uuid', () => ({
  v4: () => 'mocked-uuid-123',
}));

describe('GoogleWatchRenewalWorker', () => {
  let worker: GoogleWatchRenewalWorker;
  let repo: jest.Mocked<CalendarRepository>;
  let googleCalendarService: jest.Mocked<GoogleCalendarService>;

  beforeEach(() => {
    repo = {
      findExpiringSyncChannels: jest.fn(),
    } as any;

    googleCalendarService = {
      stopWatchChannel: jest.fn(),
      registerWatchChannel: jest.fn(),
    } as any;

    worker = new GoogleWatchRenewalWorker(repo, googleCalendarService);
  });

  describe('renewExpiringChannels()', () => {
    it('should do nothing if no expiring sync channels are found', async () => {
      repo.findExpiringSyncChannels.mockResolvedValue([]);

      await worker.renewExpiringChannels();

      expect(repo.findExpiringSyncChannels).toHaveBeenCalledWith(expect.any(Date));
      expect(googleCalendarService.stopWatchChannel).not.toHaveBeenCalled();
      expect(googleCalendarService.registerWatchChannel).not.toHaveBeenCalled();
    });

    it('should stop and register new watch channel for each expiring sync record', async () => {
      const expiringSyncs = [
        { userId: 'user-1', spaceId: 'space-1' },
        { userId: 'user-2', spaceId: 'space-1' },
      ];

      repo.findExpiringSyncChannels.mockResolvedValue(expiringSyncs as any);

      await worker.renewExpiringChannels();

      expect(googleCalendarService.stopWatchChannel).toHaveBeenCalledTimes(2);
      expect(googleCalendarService.registerWatchChannel).toHaveBeenCalledTimes(2);

      expect(googleCalendarService.stopWatchChannel).toHaveBeenNthCalledWith(1, 'user-1', 'space-1');
      expect(googleCalendarService.registerWatchChannel).toHaveBeenNthCalledWith(1, 'user-1', 'space-1');

      expect(googleCalendarService.stopWatchChannel).toHaveBeenNthCalledWith(2, 'user-2', 'space-1');
      expect(googleCalendarService.registerWatchChannel).toHaveBeenNthCalledWith(2, 'user-2', 'space-1');
    });

    it('should not crash other renewals if one channel renewal throws an error', async () => {
      const expiringSyncs = [
        { userId: 'user-1', spaceId: 'space-1' },
        { userId: 'user-2', spaceId: 'space-1' },
      ];

      repo.findExpiringSyncChannels.mockResolvedValue(expiringSyncs as any);

      // Make first renewal throw an error
      googleCalendarService.stopWatchChannel.mockRejectedValueOnce(new Error('Google API Error'));

      await expect(worker.renewExpiringChannels()).resolves.not.toThrow();

      // Verify second renewal was still called (stop is called twice, but register only once due to first error)
      expect(googleCalendarService.stopWatchChannel).toHaveBeenCalledTimes(2);
      expect(googleCalendarService.registerWatchChannel).toHaveBeenCalledTimes(1);
    });

    it('should catch top-level errors if repository lookup fails', async () => {
      repo.findExpiringSyncChannels.mockRejectedValue(new Error('DB Down'));

      await expect(worker.renewExpiringChannels()).resolves.not.toThrow();
    });
  });
});
