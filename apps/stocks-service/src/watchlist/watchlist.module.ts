import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { WatchlistController } from './watchlist.controller';
import { WatchlistService } from './watchlist.service';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])],
  controllers: [WatchlistController],
  providers: [WatchlistService],
})
export class WatchlistModule {}
