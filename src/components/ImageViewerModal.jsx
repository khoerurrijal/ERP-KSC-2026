import { X } from 'lucide-react'
import Image from 'next/image'

export default function ImageViewerModal({ isOpen, onClose, imageUrl }) {
  if (!isOpen || !imageUrl) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col items-center justify-center pointer-events-none">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute -top-12 right-0 md:-right-12 w-10 h-10 bg-white/10 text-white hover:bg-white/20 hover:text-red-400 rounded-full flex items-center justify-center backdrop-blur-md transition-all shadow-xl pointer-events-auto z-10"
        >
          <X className="w-6 h-6" />
        </button>
        
        {/* Image Container */}
        <div className="relative w-full h-[85vh] flex items-center justify-center pointer-events-auto">
          <Image 
            src={imageUrl} 
            alt="Mockup Zoom" 
            fill
            className="object-contain rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 animate-in zoom-in-95 duration-300"
          />
        </div>
      </div>
      
      {/* Click outside to close */}
      <div 
        className="absolute inset-0 -z-10" 
        onClick={onClose}
      />
    </div>
  )
}
