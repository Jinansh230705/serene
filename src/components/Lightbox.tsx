'use client';

import React, { useState, useEffect, useRef } from 'react';

interface CompiledMedia {
  url: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
}

interface Tweet {
  id: string;
  authorName: string;
  authorHandle: string;
  tweetUrl: string;
  text: string;
  hashtags: string[];
  media: CompiledMedia[];
  category: string;
  collectedAt: string;
}

interface LightboxProps {
  tweet: Tweet;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  isDevMode?: boolean;
  onRemove?: (id: string, imageUrl?: string) => void;
  initialMediaIndex?: number;
}

export default function Lightbox({ tweet, onClose, onNext, onPrev, isDevMode, onRemove, initialMediaIndex = 0 }: LightboxProps) {
  const [currentImgIndex, setCurrentImgIndex] = useState(initialMediaIndex);
  const [loaded, setLoaded] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  
  // Reporting state
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState('Not an Art');
  const [reportDetails, setReportDetails] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);

  // Reset states when tweet or initial index changes
  useEffect(() => {
    setCurrentImgIndex(initialMediaIndex);
    setLoaded(false);
  }, [tweet, initialMediaIndex]);

  // Check if image is already cached and complete
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete) {
      setLoaded(true);
    }
  }, [currentImgIndex, tweet]);

  const handleRemove = async (imageUrl?: string) => {
    setIsRemoving(true);
    try {
      const bodyPayload = imageUrl ? { id: tweet.id, imageUrl } : { id: tweet.id };
      const response = await fetch('/api/remove-like', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyPayload),
      });

      if (response.ok) {
        if (onRemove) {
          onRemove(tweet.id, imageUrl);
        }
      } else {
        const data = await response.json();
        alert(`Error: ${data.error || 'Failed to remove.'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to send remove request.');
    } finally {
      setIsRemoving(false);
    }
  };

  const handleDownload = async () => {
    if (!activeMedia?.url) return;
    try {
      const response = await fetch(activeMedia.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = activeMedia.url.split('/').pop()?.split('?')[0] || 'download.jpg';
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (e) {
      console.error('Failed to download image', e);
      window.open(activeMedia.url, '_blank');
    }
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsReporting(true);
    try {
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tweetId: tweet.id,
          imageUrl: activeMedia?.url,
          reason: reportReason,
          details: reportReason === 'Other' ? reportDetails : ''
        })
      });
      if (response.ok) {
        setReportSuccess(true);
        setTimeout(() => {
          setShowReportForm(false);
          setReportSuccess(false);
          setReportReason('Not an Art');
          setReportDetails('');
        }, 2000);
      } else {
        alert('Failed to submit report. Please try again.');
      }
    } catch (err) {
      alert('Error submitting report.');
    } finally {
      setIsReporting(false);
    }
  };

  const [showShareToast, setShowShareToast] = useState(false);

  const handleShare = async () => {
    try {
      const shareUrl = `${window.location.origin}${window.location.pathname}?image=${tweet.id}-${currentImgIndex}`;
      await navigator.clipboard.writeText(shareUrl);
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        if (tweet.media.length > 1 && currentImgIndex < tweet.media.length - 1) {
          // Switch image in the same tweet
          setCurrentImgIndex(prev => prev + 1);
          setLoaded(false);
        } else if (onNext) {
          // Switch to next tweet
          onNext();
        }
      } else if (e.key === 'ArrowLeft') {
        if (tweet.media.length > 1 && currentImgIndex > 0) {
          // Switch image in the same tweet
          setCurrentImgIndex(prev => prev - 1);
          setLoaded(false);
        } else if (onPrev) {
          // Switch to prev tweet
          onPrev();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tweet, currentImgIndex, onClose, onNext, onPrev]);

  const activeMedia = tweet.media[currentImgIndex];
  const hasMultipleImages = tweet.media.length > 1;

  const cleanText = tweet.text
    .replace(/https:\/\/t\.co\/\w+/g, '') // remove t.co links
    .trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 backdrop-blur-md bg-[#FAF8F5]/80 transition-all duration-300">
      
      {/* Viewport Floating Tweet Navigation Buttons */}
      {onPrev && (
        <button
          onClick={onPrev}
          className="fixed lightbox-btn-prev transform -translate-y-1/2 p-2.5 md:p-3.5 rounded-full bg-[#FAF8F5]/95 border border-[#EAE4D9] text-[#8E8477] hover:text-[#2E2B29] hover:shadow-md transition-all z-50 cursor-pointer shadow-sm"
          aria-label="Previous artwork"
        >
          <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
          </svg>
        </button>
      )}
      {onNext && (
        <button
          onClick={onNext}
          className="fixed lightbox-btn-next transform -translate-y-1/2 p-2.5 md:p-3.5 rounded-full bg-[#FAF8F5]/95 border border-[#EAE4D9] text-[#8E8477] hover:text-[#2E2B29] hover:shadow-md transition-all z-50 cursor-pointer shadow-sm"
          aria-label="Next artwork"
        >
          <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      )}

      {/* Main Container (Skeuomorphic Device Frame) */}
      <div className="relative w-full max-w-6xl skeuo-lightbox-frame z-10 flex h-[90vh] md:h-[80vh] overflow-hidden">
          
          {/* Action Buttons on the Bezel */}
          <div className="absolute top-2 right-2 md:top-4 md:right-4 z-30 flex items-center gap-2">
            <button 
              onClick={onClose}
              className="p-1.5 md:p-2 rounded-full bg-[#FAF8F5]/90 border border-[#EAE4D9] text-[#8E8477] hover:text-[#2E2B29] transition-colors shadow-sm cursor-pointer"
              aria-label="Close lightbox"
            >
              <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Recessed Screen Area */}
          <div className="skeuo-screen flex flex-col md:flex-row w-full h-full overflow-hidden relative">

            {/* Media Preview Section (Left/Center) */}
            <div className="relative flex-grow bg-[#F5F2EB] flex items-center justify-center p-4 md:p-8 h-[55%] md:h-full group">
              
              {/* Loading Indicator */}
              {!loaded && (
                <div className="absolute inset-0 bg-[#F5F2EB] flex items-center justify-center z-10">
                  <span className="text-xs tracking-widest text-[#8E8477] uppercase animate-pulse">Loading artwork</span>
                </div>
              )}

              {/* Active Image */}
              {activeMedia?.url && (
                <img
                  ref={imgRef}
                  src={activeMedia.url}
                  alt={cleanText || `Artwork by ${tweet.authorName}`}
                  onLoad={() => setLoaded(true)}
                  onError={() => setLoaded(true)}
                  className={`max-w-full max-h-full object-contain transition-opacity duration-500 ${
                    loaded ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              )}

              {/* Carousel Controls (within the same tweet) */}
              {hasMultipleImages && (
                <>
                  {currentImgIndex > 0 && (
                    <button
                      onClick={() => {
                        setCurrentImgIndex(prev => prev - 1);
                        setLoaded(false);
                      }}
                      className="absolute left-6 md:left-8 p-2 rounded-full bg-[#FAF8F5]/85 border border-[#EAE4D9] text-[#8E8477] hover:text-[#2E2B29] transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                      </svg>
                    </button>
                  )}
                  {currentImgIndex < tweet.media.length - 1 && (
                    <button
                      onClick={() => {
                        setCurrentImgIndex(prev => prev + 1);
                        setLoaded(false);
                      }}
                      className="absolute right-6 md:right-8 p-2 rounded-full bg-[#FAF8F5]/85 border border-[#EAE4D9] text-[#8E8477] hover:text-[#2E2B29] transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                  )}

                {/* Indicator dots */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-1.5 z-10 bg-[#FBF9F6]/80 px-3 py-1.5 rounded-full border border-[#EAE4D9]/60 backdrop-blur-sm">
                  {tweet.media.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setCurrentImgIndex(i);
                        setLoaded(false);
                      }}
                      className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer ${
                        i === currentImgIndex ? 'bg-[#2E2B29] scale-125' : 'bg-[#8E8477]/40'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}


          </div>

          {/* Metadata Details Sidebar (Right) */}
          <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-[#EAE4D9]/80 p-6 md:p-8 bg-[#FBF9F6] flex flex-col justify-between h-[45%] md:h-full overflow-y-auto z-10">
            <div>
              {/* Category tag */}
              <span className="text-[10px] tracking-widest text-[#8E8477] uppercase font-bold block mb-4">
                {tweet.category}
              </span>

              {/* Artist Attribution & Actions */}
              <div className="mb-6 flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-bold text-[#2E2B29] tracking-tight leading-snug">
                    {tweet.authorName}
                  </h2>
                  <a 
                    href={`https://x.com/${tweet.authorHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#8E8477] hover:text-[#2E2B29] hover:underline inline-flex items-center gap-1 mt-1 font-medium transition-colors"
                  >
                    @{tweet.authorHandle}
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                </div>
                
                <div className="flex items-center gap-1.5 relative">
                  {showShareToast && (
                    <span className="absolute -top-8 right-0 text-[10px] text-green-700 bg-green-50 px-2 py-1 rounded-full shadow-sm whitespace-nowrap">
                      Copied link!
                    </span>
                  )}
                  <button 
                    onClick={handleShare}
                    className="p-1.5 rounded-full bg-white border border-[#EAE4D9] text-[#8E8477] hover:text-[#2E2B29] hover:scale-105 transition-all shadow-sm cursor-pointer"
                    title="Share image link"
                    aria-label="Share image link"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                  </button>
                  <button 
                    onClick={handleDownload}
                    className="p-1.5 rounded-full bg-white border border-[#EAE4D9] text-[#8E8477] hover:text-[#2E2B29] hover:scale-105 transition-all shadow-sm cursor-pointer"
                    title="Download image"
                    aria-label="Download image"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Collection Thumbnails ("From the same collection") */}
              {tweet.media.length > 1 && (
                <div className="mb-6 border-t border-[#EAE4D9]/50 pt-5">
                  <span className="text-[10px] tracking-widest text-[#8E8477] uppercase font-semibold block mb-2.5">
                    From the same collection
                  </span>
                  <div className="flex gap-2.5 overflow-x-auto pb-1.5 no-scrollbar">
                    {tweet.media.map((m, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setCurrentImgIndex(idx);
                          setLoaded(false);
                        }}
                        className={`relative w-12 h-12 flex-shrink-0 rounded-sm overflow-hidden border transition-all duration-300 cursor-pointer ${
                          idx === currentImgIndex
                            ? 'border-[#2E2B29] scale-105 shadow-sm'
                            : 'border-[#EAE4D9] hover:border-[#8E8477]'
                        }`}
                      >
                        <img
                          src={m.url}
                          alt={`Collection item ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Description (Post Text) */}
              <div className="mb-6 border-t border-[#EAE4D9]/50 pt-5">
                <span className="text-[10px] tracking-widest text-[#8E8477] uppercase font-semibold block mb-2">
                  Attribution Text
                </span>
                <p className="text-sm text-[#5C544A] leading-relaxed italic font-light whitespace-pre-wrap">
                  {cleanText ? `"${cleanText}"` : 'No post description provided by the artist.'}
                </p>
              </div>
            </div>

            {/* Technical Metadata (Wallpaper Engine Details) */}
            <div className="border-t border-[#EAE4D9]/50 pt-5">
              <span className="text-[10px] tracking-widest text-[#8E8477] uppercase font-semibold block mb-3">
                Image Metadata
              </span>
              <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs font-medium text-[#8E8477]">
                <div>
                  <span className="block text-[9px] text-[#8E8477]/60 uppercase tracking-wider mb-0.5">Resolution</span>
                  <span className="text-[#2E2B29]">
                    {activeMedia?.width && activeMedia?.height 
                      ? `${activeMedia.width} × ${activeMedia.height}` 
                      : 'Unresolved'}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] text-[#8E8477]/60 uppercase tracking-wider mb-0.5">Aspect Ratio</span>
                  <span className="text-[#2E2B29]">
                    {activeMedia?.aspectRatio 
                      ? `${activeMedia.aspectRatio.toFixed(2)}:1` 
                      : 'Unresolved'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="block text-[9px] text-[#8E8477]/60 uppercase tracking-wider mb-0.5">Source URL</span>
                  <a 
                    href={tweet.tweetUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-[#2E2B29] hover:underline truncate block max-w-full hover:text-black transition-colors"
                  >
                    {tweet.tweetUrl}
                  </a>
                </div>
              </div>
            </div>

            {/* Action Section (Report & Dev Controls) */}
            <div className="border-t border-[#EAE4D9]/50 pt-4 mt-4 flex flex-col gap-3">
              {/* Report Control */}
              <div className="relative w-full">
                <button
                  onClick={() => setShowReportForm(!showReportForm)}
                  className={`w-full flex items-center justify-center gap-2 py-2 px-3 border rounded text-[10px] tracking-widest uppercase font-semibold transition-all duration-300 cursor-pointer ${showReportForm ? 'bg-[#2E2B29] text-[#FAF8F5] border-[#2E2B29]' : 'bg-[#FBF9F6] text-[#8E8477] border-[#EAE4D9] hover:border-[#2E2B29] hover:text-[#2E2B29]'}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Report Issue
                </button>

                {/* Report Dropdown Form */}
                {showReportForm && (
                  <div className="absolute bottom-full left-0 mb-2 bg-[#FAF8F5] border border-[#EAE4D9] shadow-lg rounded-xl p-4 w-full text-left animate-in fade-in zoom-in-95 z-50">
                    {reportSuccess ? (
                      <div className="text-green-600 flex flex-col items-center py-2 text-sm">
                        <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Report Submitted
                      </div>
                    ) : (
                      <form onSubmit={handleReport} className="flex flex-col gap-3">
                        <h4 className="font-semibold text-[#2E2B29] text-sm">Report Image</h4>
                        <div className="flex flex-col gap-2">
                          {['Not an Art', 'Not upto quality', 'Copyright', 'Other'].map(reason => (
                            <label key={reason} className="flex items-center gap-2 text-sm text-[#4A453F] cursor-pointer">
                              <input 
                                type="radio" 
                                name="reportReason" 
                                value={reason}
                                checked={reportReason === reason}
                                onChange={(e) => setReportReason(e.target.value)}
                                className="text-[#2E2B29] focus:ring-[#2E2B29]"
                              />
                              {reason}
                            </label>
                          ))}
                        </div>
                        {reportReason === 'Other' && (
                          <input 
                            type="text" 
                            placeholder="Please specify..." 
                            value={reportDetails}
                            onChange={(e) => setReportDetails(e.target.value)}
                            className="w-full mt-1 p-2 text-sm border border-[#EAE4D9] rounded bg-white text-[#2E2B29] focus:outline-none focus:border-[#8E8477]"
                            required
                          />
                        )}
                        <div className="mt-2 flex justify-end gap-2">
                          <button 
                            type="button" 
                            onClick={() => setShowReportForm(false)}
                            className="px-3 py-1.5 text-xs text-[#8E8477] hover:text-[#2E2B29] transition-colors"
                          >
                            Cancel
                          </button>
                          <button 
                            type="submit" 
                            disabled={isReporting}
                            className="px-3 py-1.5 text-xs bg-[#2E2B29] text-white rounded hover:bg-black disabled:opacity-50 transition-colors"
                          >
                            {isReporting ? 'Sending...' : 'Submit'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>

              {/* Development mode delete control */}
              {isDevMode && onRemove && (
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    disabled={isRemoving}
                    onClick={() => handleRemove(activeMedia?.url)}
                    className="w-full text-center py-2 px-3 border rounded text-[10px] tracking-widest uppercase font-semibold transition-all duration-300 cursor-pointer bg-[#FBF9F6] text-[#8E8477] border-[#EAE4D9] hover:border-orange-300 hover:text-orange-500 hover:bg-orange-50/20"
                  >
                    {isRemoving ? 'Removing...' : 'Remove This Image'}
                  </button>
                  <button
                    disabled={isRemoving}
                    onClick={() => handleRemove()}
                    className="w-full text-center py-2 px-3 border rounded text-[10px] tracking-widest uppercase font-semibold transition-all duration-300 cursor-pointer bg-[#FBF9F6] text-[#8E8477] border-[#EAE4D9] hover:border-red-300 hover:text-red-500 hover:bg-red-50/20"
                  >
                    {isRemoving ? 'Removing...' : 'Remove Entire Post'}
                  </button>
                </div>
              )}
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
