import React, { useState, useEffect, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { TabPanel, useTabs } from "react-headless-tabs";
import { TabSelector } from "../../components/tabSelector";

const SignatureInput = ({ 
    sigPad, 
    setSignaturePad, 
    signatureRef, 
    origin, 
    clearSignature, 
    existingSignature,
    signatureType,
    setSignatureType,
    bookingAmended,
    onSignatureLoaded
  }) => {
    const [selectedTab, setSelectedTab] = useState('draw');
    const [uploadedSignature, setUploadedSignature] = useState(null);
    const [hasSignature, setHasSignature] = useState(false);
    const [isDrawn, setIsDrawn] = useState(false);
    const [localSigPad, setLocalSigPad] = useState(null);
    const containerRef = useRef(null);
    const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
    const isAdmin = origin === 'admin';
    const [addingSignature, setAddingSignature] = useState(false);

    useEffect(() => {
      const updateCanvasDimensions = () => {
        if (containerRef.current) {
          const container = containerRef.current;
          const rect = container.getBoundingClientRect();
          
          setCanvasDimensions({
            width: rect.width,
            height: 200
          });
        }
      };
  
      updateCanvasDimensions();
      window.addEventListener('resize', updateCanvasDimensions);
  
      return () => {
        window.removeEventListener('resize', updateCanvasDimensions);
      };
    }, []);
  
    const loadExistingSignature = () => {
      if (!existingSignature) {
        onSignatureLoaded?.(false);
        return;
      }
  
      // console.log('Loading existing signature...', { signatureType, existingSignature: !!existingSignature });
      
      const isDrawnSig = signatureType === 'drawn';
      setSelectedTab(isDrawnSig ? 'draw' : 'upload');
      setIsDrawn(isDrawnSig);
  
      if (isDrawnSig) {
        setUploadedSignature(null);
        
        if (localSigPad) {
          const image = new Image();
          image.onload = () => {
            const canvas = localSigPad.getCanvas();
            if (canvas) {
              const ctx = canvas.getContext('2d');
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              
              // ✅ FIX: Better scaling with max dimensions to prevent oversized signatures
              const maxWidth = canvas.width * 0.85;  // Use 85% of canvas width
              const maxHeight = canvas.height * 0.75; // Use 75% of canvas height
              
              const scale = Math.min(
                maxWidth / image.width,
                maxHeight / image.height,
                1 // Never scale up, only down
              );
              
              const scaledWidth = image.width * scale;
              const scaledHeight = image.height * scale;
              
              const x = (canvas.width - scaledWidth) / 2;
              const y = (canvas.height - scaledHeight) / 2;
              
              ctx.drawImage(image, x, y, scaledWidth, scaledHeight);
              setHasSignature(true);
              setSignaturePad(localSigPad);
              onSignatureLoaded?.(true);
              // console.log('Drawn signature loaded successfully');
            }
          };
          image.onerror = () => {
            console.error('Failed to load existing signature image');
            onSignatureLoaded?.(false);
          };
          image.src = existingSignature;
        } else {
          console.warn('No localSigPad available for drawn signature');
          onSignatureLoaded?.(false);
        }
      } else {
        if (localSigPad) {
          localSigPad.clear();
        }
        setUploadedSignature(existingSignature);
        setHasSignature(true);
        createSignaturePadFromImage(existingSignature);
      }
    };
  
    const createSignaturePadFromImage = (imageData) => {
        const img = new Image();
        img.onload = () => {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvasDimensions.width || 400;
            tempCanvas.height = canvasDimensions.height || 200;
            const ctx = tempCanvas.getContext('2d');
            
            ctx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
            
            // ✅ FIX: Better scaling with max dimensions to prevent oversized signatures
            const maxWidth = tempCanvas.width * 0.85;  // Use 85% of canvas width
            const maxHeight = tempCanvas.height * 0.75; // Use 75% of canvas height
            
            const scale = Math.min(
                maxWidth / img.width,
                maxHeight / img.height,
                1 // Never scale up, only down
            );
            
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;
            
            const x = (tempCanvas.width - scaledWidth) / 2;
            const y = (tempCanvas.height - scaledHeight) / 2;
            
            ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
    
            const mockSignaturePad = {
                isEmpty: () => false,
                getTrimmedCanvas: () => tempCanvas,
                clear: () => {
                    ctx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
                    setUploadedSignature(null);
                    setHasSignature(false);
                },
                fromDataURL: (url) => {
                    const img = new Image();
                    img.src = url;
                    img.onload = () => ctx.drawImage(img, 0, 0);
                }
            };
            
            setSignaturePad(mockSignaturePad);
            onSignatureLoaded?.(true);
            // console.log('Uploaded signature loaded successfully');
        };
        img.onerror = () => {
            console.error('Failed to load uploaded signature image');
            onSignatureLoaded?.(false);
        };
        img.src = imageData;
    };
  
    useEffect(() => {
      if (existingSignature && signatureType) {
        if (signatureType === 'drawn' && !localSigPad) {
          // Wait for localSigPad to be ready for drawn signatures
          const checkLocalSigPad = () => {
            if (localSigPad) {
              loadExistingSignature();
            } else {
              setTimeout(checkLocalSigPad, 100); // Retry every 100ms
            }
          };
          checkLocalSigPad();
        } else if (signatureType === 'uploaded') {
          // For uploaded signatures, we don't need localSigPad
          loadExistingSignature();
        } else if (signatureType === 'drawn' && localSigPad) {
          // localSigPad is ready for drawn signature
          loadExistingSignature();
        }
      } else if (!existingSignature) {
        onSignatureLoaded?.(false);
      }
    }, [existingSignature, signatureType, localSigPad, canvasDimensions]);
  
    const handleFileUpload = (event) => {
      if (isAdmin) return;
      
      const file = event.target.files[0];
      if (!file) return;
  
      const reader = new FileReader();
      reader.onload = (e) => {
        if (localSigPad) {
          localSigPad.clear();
        }
        
        setIsDrawn(false);
        setUploadedSignature(e.target.result);
        setHasSignature(true);
        setSelectedTab('upload');
        
        createSignaturePadFromImage(e.target.result);
        setAddingSignature(true);
      };
      reader.readAsDataURL(file);
    };
  
    const handleDrawnSignatureChange = () => {
        if (isAdmin) return;
        
        if (localSigPad && !localSigPad.isEmpty()) {
            setIsDrawn(true);
            setUploadedSignature(null);
            setHasSignature(true);
            setSelectedTab('draw');
            setSignaturePad(localSigPad);
            setAddingSignature(true);
        }
    };
  
    const handleTabChange = (tab) => {
      if (isAdmin) return;
      
      setSelectedTab(tab);
      if (tab === 'draw') {
        if (isDrawn) {
          setUploadedSignature(null);
        }
        setSignatureType('drawn');
      } else {
        if (uploadedSignature) {
          if (localSigPad) {
            localSigPad.clear();
            setIsDrawn(false);
          }
        }
        setSignatureType('uploaded');
      }
    };
  
    const handleClear = () => {
      if (isAdmin) return;

      if (localSigPad) {
        localSigPad.clear();
      }
      setHasSignature(false);
      setIsDrawn(false);
      setUploadedSignature(null);
      clearSignature();
      setSignaturePad(null);
    
      const fileInput = document.getElementById('signature-upload');
      if (fileInput) {
        fileInput.value = '';
      }
    };

    const renderSignatureArea = () => {
      if (isAdmin) {
        return (
          <div 
            className="border rounded-lg p-2 bg-white"
            style={{
              height: '200px',
              width: '100%',
              position: 'relative'
            }}
          >
            {existingSignature ? (
              <img 
                src={existingSignature} 
                alt="Existing signature" 
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                No signature available
              </div>
            )}
          </div>
        );
      }

      return (
        <div className="space-y-4">
          <nav className="flex border-b border-gray-300">
            <TabSelector
              isActive={selectedTab === 'draw'}
              onClick={() => handleTabChange('draw')}
            >
              Draw Signature
            </TabSelector>
            <TabSelector
              isActive={selectedTab === 'upload'}
              onClick={() => handleTabChange('upload')}
            >
              Upload Signature
            </TabSelector>
          </nav>

          <TabPanel hidden={selectedTab !== 'draw'}>
            <div 
              ref={containerRef} 
              className="border rounded-lg p-2 bg-white"
              style={{
                height: '200px',
                width: '100%',
                position: 'relative'
              }}
            >
              {canvasDimensions.width > 0 && (
                <SignatureCanvas
                    ref={(ref) => {
                        if (ref) {
                            setLocalSigPad(ref);
                            signatureRef.current = ref;
                            // console.log('SignatureCanvas ref set');
                        }
                    }}
                    onEnd={handleDrawnSignatureChange}
                    canvasProps={{
                        className: 'signature-canvas',
                        width: canvasDimensions.width,
                        height: canvasDimensions.height,
                        style: {
                          width: '100%',
                          height: '100%',
                        },
                    }}
                />
              )}
              {hasSignature && (
                <div className="absolute bottom-2 right-2">
                  <button 
                    onClick={handleClear}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 bg-white rounded"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </TabPanel>

          <TabPanel hidden={selectedTab !== 'upload'}>
            <div 
              className="border rounded-lg p-2 bg-white"
              style={{
                height: '200px',
                width: '100%',
                position: 'relative'
              }}
            >
              {!uploadedSignature && (
                <div className="flex flex-col items-center justify-center h-full">
                  <label 
                    htmlFor="signature-upload" 
                    className="px-4 py-2 bg-blue-600 text-white rounded cursor-pointer hover:bg-blue-700"
                  >
                    Choose File
                  </label>
                  <input
                    id="signature-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Upload a signature image (PNG, JPG, etc.)
                  </p>
                </div>
              )}
              
              {uploadedSignature && (
                <div className="relative h-full">
                  <div className="h-full flex items-center justify-center">
                    <img 
                      src={uploadedSignature} 
                      alt="Uploaded signature" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="absolute bottom-2 right-2">
                    <button 
                      onClick={() => {
                        const fileInput = document.getElementById('signature-upload');
                        if (fileInput) {
                          fileInput.value = '';
                        }
                        setUploadedSignature(null);
                        setHasSignature(false);
                        if (sigPad?.clear) {
                          sigPad.clear();
                        }
                        setSignaturePad(null);
                      }}
                      className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 bg-white rounded"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>
          </TabPanel>
        </div>
      );
    };

    useEffect(() => {
      if (bookingAmended && !addingSignature) {
        if (localSigPad) {
          localSigPad.clear();
        }
        setHasSignature(false);
        setIsDrawn(false);
        setUploadedSignature(null);
        clearSignature();
        setSignaturePad(null);
        
        const fileInput = document.getElementById('signature-upload');
        if (fileInput) {
          fileInput.value = '';
        }
      }
    }, [bookingAmended, localSigPad, clearSignature, setSignaturePad, addingSignature]);

    return (
      <div className="space-y-4">
        <h3 className="font-semibold mb-2 text-slate-700">Signature</h3>
        {renderSignatureArea()}
      </div>
    );
};

export default SignatureInput;