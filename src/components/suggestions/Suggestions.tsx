'use client';

import { Carousel } from './Carousel';
import { AnnouncementTicker } from './AnnouncementTicker';

interface SuggestionsProps {
  announcementMessage?: string;
}

export const Suggestions: React.FC<SuggestionsProps> = ({ 
  announcementMessage = "Indian Railways extends Covid guidelines, doing thermal screening of passengers" 
}) => {
  return (
    <>
      {/* Carousel Section */}
      <div className="flex-shrink-0" style={{ touchAction: 'pan-x' }}>
        <Carousel />
      </div>

      {/* Announcement Ticker */}
      <div className="flex-shrink-0" style={{ touchAction: 'none' }}>
        <AnnouncementTicker message={announcementMessage} />
      </div>
    </>
  );
};
