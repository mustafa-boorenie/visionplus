'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Camera, Maximize2, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface ScreenshotCarouselProps {
  screenshots: string[];
  sessionId: string;
}

export function ScreenshotCarousel({ screenshots, sessionId }: ScreenshotCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(screenshots.length - 1);
  const [showFullscreen, setShowFullscreen] = useState(false);

  const handlePrevious = () => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : screenshots.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex(prev => (prev < screenshots.length - 1 ? prev + 1 : 0));
  };

  const currentScreenshot = screenshots[currentIndex];
  const screenshotUrl = apiClient.getScreenshotUrl(sessionId, currentScreenshot);

  if (screenshots.length === 0) {
    return null;
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Camera className="w-5 h-5 mr-2 text-gray-600 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Screenshots
            </h2>
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
              ({currentIndex + 1} of {screenshots.length})
            </span>
          </div>
          <button
            onClick={() => setShowFullscreen(true)}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            title="View fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        <div className="relative bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden">
          <div className="relative aspect-video">
            <Image
              src={screenshotUrl}
              alt={`Screenshot ${currentIndex + 1}`}
              fill
              className="object-contain"
              priority
            />
          </div>

          {screenshots.length > 1 && (
            <>
              <button
                onClick={handlePrevious}
                className="absolute left-2 top-1/2 transform -translate-y-1/2 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-opacity"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-opacity"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        <div className="mt-4 flex justify-center gap-2">
          {screenshots.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentIndex
                  ? 'bg-blue-600'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>

        <div className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
          {currentScreenshot}
        </div>
      </div>

      {/* Fullscreen Modal */}
      {showFullscreen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-8"
          onClick={() => setShowFullscreen(false)}
        >
          <div className="relative max-w-full max-h-full">
            <Image
              src={screenshotUrl}
              alt={`Screenshot ${currentIndex + 1} (fullscreen)`}
              width={1920}
              height={1080}
              className="object-contain max-w-full max-h-[90vh]"
              priority
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowFullscreen(false);
              }}
              className="absolute top-4 right-4 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </>
  );
} 