'use client';

import React, { useRef, useState, useEffect } from 'react';

interface CarouselSlide {
  id: number;
  title: string;
  subtitle: string;
  bgColor: string;
  icon: string;
}

const slides: CarouselSlide[] = [
  {
    id: 1,
    title: '10% OFF',
    subtitle: 'On all url bookings',
    bgColor: 'from-pink-300 to-pink-400',
    icon: '🛍️'
  },
  {
    id: 2,
    title: '20% Cashback',
    subtitle: 'On first transaction',
    bgColor: 'from-blue-300 to-blue-400',
    icon: '💰'
  },
  {
    id: 3,
    title: 'Free Shipping',
    subtitle: 'On orders above $50',
    bgColor: 'from-purple-300 to-purple-400',
    icon: '🚚'
  },
  {
    id: 4,
    title: 'Special Deals',
    subtitle: 'Limited time offer',
    bgColor: 'from-green-300 to-green-400',
    icon: '🎁'
  },
  {
    id: 5,
    title: 'Member Bonus',
    subtitle: 'Exclusive for members',
    bgColor: 'from-orange-300 to-orange-400',
    icon: '⭐'
  }
];

export const Carousel: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!scrollRef.current) return;
      
      const scrollLeft = scrollRef.current.scrollLeft;
      const cardWidth = window.innerWidth - 40 + 24; // Full width minus padding (20px each side) + gap (1.5rem = 24px)
      const index = Math.round(scrollLeft / cardWidth);
      setActiveIndex(Math.max(0, Math.min(index, slides.length - 1)));
    };

    const scrollElement = scrollRef.current;
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll);
      return () => scrollElement.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const scrollToIndex = (index: number) => {
    if (!scrollRef.current) return;
    const cardWidth = window.innerWidth - 40 + 24; // Full width minus padding (20px each side) + gap (1.5rem = 24px)
    scrollRef.current.scrollTo({
      left: index * cardWidth,
      behavior: 'smooth'
    });
  };

  return (
    <section className="pt-2 pb-1 bg-white">
      <div 
        ref={scrollRef}
        className="flex overflow-x-auto scrollbar-hide snap-x snap-mandatory"
        style={{
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          paddingLeft: '1.25rem',
          paddingRight: '1.25rem',
          scrollPaddingLeft: '1.25rem',
          scrollPaddingRight: '1.25rem'
        }}
      >
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className={`h-[140px] bg-gradient-to-r ${slide.bgColor} flex-shrink-0 snap-start`}
            style={{ 
              borderRadius: '10px',
              width: 'calc(100vw - 2.5rem)',
              marginRight: index < slides.length - 1 ? '1.5rem' : '0'
            }}
          >
            <div className="w-full h-full flex items-center px-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl flex-shrink-0" style={{ borderRadius: '10px' }}>
                  {slide.icon}
                </div>
                <div>
                  <h2 className="text-white text-xl font-bold">{slide.title}</h2>
                  <p className="text-white text-sm opacity-90">{slide.subtitle}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Dots indicator */}
      <div className="flex justify-center gap-1.5 mt-3">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => scrollToIndex(index)}
            className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
              index === activeIndex 
                ? '' 
                : 'bg-gray-300'
            }`}
            style={index === activeIndex ? {
              background: 'linear-gradient(180deg, #0038FF 0%, #5CE2FF 100%)'
            } : {}}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
};
