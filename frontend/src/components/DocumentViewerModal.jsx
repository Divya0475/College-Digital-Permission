import React from 'react';
import { X, ExternalLink, Download } from 'lucide-react';

const DocumentViewerModal = ({ isOpen, onClose, url, title = "Document Viewer" }) => {
    if (!isOpen) return null;
    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'white', borderRadius: 8, width: '90%', maxWidth: 800, height: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: 16, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>{title}</h3>
                    <div style={{ display: 'flex', gap: 10 }}>
                        {url && (
                            <>
                                <a href={url} download target="_blank" rel="noreferrer" style={{ color: '#666' }}><Download size={20} /></a>
                                <a href={url} target="_blank" rel="noreferrer" style={{ color: '#666' }}><ExternalLink size={20} /></a>
                            </>
                        )}
                        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}><X size={20} /></button>
                    </div>
                </div>
                <div style={{ flex: 1, padding: 16, overflow: 'auto' }}>
                    {url ? (
                        <iframe src={url} style={{ width: '100%', height: '100%', border: 'none' }} title={title} />
                    ) : (
                        <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#666' }}>No document available</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DocumentViewerModal;
