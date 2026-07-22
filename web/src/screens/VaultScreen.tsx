import { useState } from 'react';
import { Icon } from '../components/Icon';

type Category = 'photos' | 'documents' | 'audio';
const photos = [
  { title: 'Early light', image: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=85' },
  { title: 'Coffee at noon', image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=85' },
  { title: 'A long weekend', image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=85' },
  { title: 'Walking home', image: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=900&q=85' },
  { title: 'The window seat', image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=900&q=85' },
  { title: 'Slow morning', image: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=900&q=85' },
];

export function VaultScreen() {
  const [category, setCategory] = useState<Category>('photos');
  return <main className="app-page library-page">
    <header className="library-header"><div><p className="eyebrow">Shared library</p><h1 className="page-title">Everything<br />you shared.</h1><p className="page-intro">Photos, notes, and recordings kept in one private place.</p></div><button className="icon-button" aria-label="Search your library"><Icon name="search" size={19} /></button></header>
    <div className="library-tabs" role="tablist" aria-label="Shared media type">
      {([{ id: 'photos', label: 'Photos' }, { id: 'documents', label: 'Documents' }, { id: 'audio', label: 'Voice notes' }] as const).map((item) => <button key={item.id} role="tab" aria-selected={category === item.id} className={category === item.id ? 'is-active' : ''} onClick={() => setCategory(item.id)}>{item.label}</button>)}
    </div>
    {category === 'photos' ? <section className="photo-grid" aria-label="Shared photos">{photos.map((photo) => <button className="library-photo" key={photo.title} onClick={() => window.alert(`Opening ${photo.title}`)}><img src={photo.image} alt={photo.title} /><span>{photo.title}</span></button>)}</section> : <section className="library-empty"><div>{category === 'documents' ? <Icon name="file" size={28} /> : <Icon name="mic" size={28} />}<p>{category === 'documents' ? 'No documents have been shared yet.' : 'No voice notes have been kept here yet.'}</p></div></section>}
  </main>;
}
