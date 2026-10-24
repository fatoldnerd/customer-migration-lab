/** Synthetic Heritage House collection. All objects, people and stories are invented. */
export interface CollectionObject {
  id: string;
  name: string;
  visibility: 'public' | 'private';
  ownerId: string;
  contributedBy: string;
  era: string;
  story: string;
  drawing: 'clock' | 'photograph' | 'sampler' | 'letters' | 'caddy' | 'tin';
}

export const collection: CollectionObject[] = [
  {
    id: 'carriage-clock',
    name: 'Brass carriage clock',
    visibility: 'public',
    ownerId: 'heritage-house',
    contributedBy: 'Heritage House public collection',
    era: 'c. 1900 (fixture text)',
    story: 'Donated to the collection with a handwritten repair tag. It is displayed in the reading room and photographed for the online catalogue.',
    drawing: 'clock',
  },
  {
    id: 'wedding-portrait',
    name: 'Wedding portrait, 1950s',
    visibility: 'private',
    ownerId: 'curator-a',
    contributedBy: 'A contributing family (fictional)',
    era: '1950s (fixture text)',
    story: 'A family photograph shared privately so that relatives can add names and memories. It must never appear in a shared cache or public listing.',
    drawing: 'photograph',
  },
  {
    id: 'stitched-sampler',
    name: 'Hand-stitched alphabet sampler',
    visibility: 'public',
    ownerId: 'heritage-house',
    contributedBy: 'Heritage House public collection',
    era: '19th century (fixture text)',
    story: 'A child’s practice piece showing alphabet rows and a border of stylised flowers. It is part of a public textiles exhibition.',
    drawing: 'sampler',
  },
  {
    id: 'bundle-of-letters',
    name: 'Bundle of letters tied with ribbon',
    visibility: 'private',
    ownerId: 'curator-a',
    contributedBy: 'A contributing family (fictional)',
    era: 'Mid-20th century (fixture text)',
    story: 'Personal correspondence between relatives who lived apart for many years. The family has asked for it to remain private.',
    drawing: 'letters',
  },
  {
    id: 'tea-caddy',
    name: 'Enamelled tea caddy',
    visibility: 'public',
    ownerId: 'heritage-house',
    contributedBy: 'Heritage House public collection',
    era: 'Early 20th century (fixture text)',
    story: 'A decorated tin used in a village shop. It appears in the public “Everyday objects” trail.',
    drawing: 'caddy',
  },
  {
    id: 'recipe-tin',
    name: 'Grandmother’s recipe tin',
    visibility: 'private',
    ownerId: 'curator-a',
    contributedBy: 'A contributing family (fictional)',
    era: '1960s (fixture text)',
    story: 'Index cards in several handwritings, with notes added over decades. Shared only with family members.',
    drawing: 'tin',
  },
];

export function getObject(id: string) {
  return collection.find((o) => o.id === id) ?? null;
}
