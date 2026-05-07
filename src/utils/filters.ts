import type { AnnexAControl, ControlCategory, ControlType, SecurityProperty, CybersecurityConcept, SecurityDomain } from '../data/types';

export interface ControlFilters {
  category: ControlCategory[];
  controlType: ControlType[];
  securityProperty: SecurityProperty[];
  cybersecurityConcept: CybersecurityConcept[];
  securityDomain: SecurityDomain[];
  newIn2022: boolean | null;
  search: string;
}

export const emptyFilters: ControlFilters = {
  category: [],
  controlType: [],
  securityProperty: [],
  cybersecurityConcept: [],
  securityDomain: [],
  newIn2022: null,
  search: '',
};

export function filterControls(controls: AnnexAControl[], filters: ControlFilters): AnnexAControl[] {
  return controls.filter(c => {
    if (filters.category.length && !filters.category.includes(c.category)) return false;
    if (filters.controlType.length && !filters.controlType.some(t => c.controlType.includes(t))) return false;
    if (filters.securityProperty.length && !filters.securityProperty.some(p => c.securityProperties.includes(p))) return false;
    if (filters.cybersecurityConcept.length && !filters.cybersecurityConcept.some(cc => c.cybersecurityConcepts.includes(cc))) return false;
    if (filters.securityDomain.length && !filters.securityDomain.some(d => c.securityDomains.includes(d))) return false;
    if (filters.newIn2022 !== null && c.isNew2022 !== filters.newIn2022) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const text = `${c.id} ${c.title} ${c.summary}`.toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });
}
