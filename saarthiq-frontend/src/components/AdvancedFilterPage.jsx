// src/components/AdvancedFilterPage.jsx - MULTI-SELECT DESIGNATION VERSION
import React, { useEffect, useState, useCallback, useRef } from 'react';
import Select from 'react-select';
import ContactPopup from './ContactPopup';
import { useNavigate, useSearchParams} from 'react-router-dom';
import backIcon from '../assets/back.png';
import { ChevronLeft, ChevronRight, Loader2, Download, Eye, EyeOff, Users, X, Search } from 'lucide-react';

const sortOptions = [
    { value: 'experience_desc', label: 'Experience (High to Low)' },
    { value: 'experience_asc', label: 'Experience (Low to High)' },
    { value: 'age_desc', label: 'Age (High to Low)' },
    { value: 'age_asc', label: 'Age (Low to High)' },
    { value: 'salary_desc', label: 'Salary (High to Low)' },
    { value: 'salary_asc', label: 'Salary (Low to High)' },
];

const normalizeOptions = (data) => {
  if (!Array.isArray(data)) return [];

  // Step 1: Basic normalize — trim + collapse spaces
  const cleaned = [];
  data.forEach(item => {
    let label, value;
    if (item && typeof item === 'object' && (item.value !== undefined || item.label !== undefined)) {
      label = String(item.label || item.value || '').trim().replace(/\s+/g, ' ');
      value = String(item.value || item.label || '').trim().replace(/\s+/g, ' ');
    } else if (typeof item === 'string' && item.trim() !== '') {
      label = item.trim().replace(/\s+/g, ' ');
      value = label;
    } else {
      return;
    }
    if (label && value) cleaned.push({ label, value });
  });

  // Step 2: Levenshtein distance for fuzzy dedup
  const levenshtein = (a, b) => {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) =>
      Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        dp[i][j] = a[i-1] === b[j-1]
          ? dp[i-1][j-1]
          : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    return dp[m][n];
  };

  // Step 3: Deduplicate — skip if too similar to an already-kept entry
  const kept = [];
  for (const item of cleaned) {
    const key = item.label.toLowerCase();
    const isDuplicate = kept.some(k => {
      const kKey = k.label.toLowerCase();
      if (kKey === key) return true;
      // Fuzzy: within 2 edits AND shorter string is >70% of longer (avoids false matches on short words)
      const maxLen = Math.max(kKey.length, key.length);
      const threshold = maxLen <= 6 ? 1 : 2;
      return levenshtein(kKey, key) <= threshold && Math.min(kKey.length, key.length) / maxLen > 0.7;
    });
    if (!isDuplicate) kept.push(item);
  }

  return kept;
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    return '';
  }
};

const getOrCreateUserInfo = () => {
  try {
    const token = localStorage.getItem('token');
    const storedDept = localStorage.getItem('userDept') || 'Business Development';
    
    let storedUserName = localStorage.getItem('userFullName') || 
                        localStorage.getItem('displayName') || 
                        localStorage.getItem('fullName') || 
                        localStorage.getItem('userName') || 
                        localStorage.getItem('name') || 
                        '';
    
    if (storedUserName && storedUserName.toLowerCase().includes('guest')) {
      storedUserName = storedUserName.replace(/guest\s*/i, '').trim();
    }
    
    if (!storedUserName || storedUserName === '') {
      storedUserName = token ? 'Logged-in User' : 'Guest User';
    }
    
    if (token) {
      const storedUserId = localStorage.getItem('userId') || 
                          localStorage.getItem('user_id') || 
                          localStorage.getItem('uid');
      
      if (storedUserId && storedUserId !== 'null' && storedUserId !== 'undefined') {
        return {
          department: storedDept,
          userId: storedUserId.toString(),
          userName: storedUserName,
          isLoggedIn: true
        };
      }
    }
    
    let storedUserId = localStorage.getItem('guestUserId');
    if (!storedUserId || storedUserId === 'null' || storedUserId === 'undefined') {
      storedUserId = 'guest-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('guestUserId', storedUserId);
    }
    
    return {
      department: storedDept,
      userId: storedUserId,
      userName: storedUserName,
      isLoggedIn: false
    };
  } catch (error) {
    return {
      department: 'Business Development',
      userId: 'guest-' + Date.now(),
      userName: 'User',
      isLoggedIn: false
    };
  }
};
// ─── IndustryFilter component ───────────────────────────────────────────────
// ─── IndustryFilter component ───────────────────────────────────────────────
const IndustryFilter = ({ industries, industry, isOptionsLoading, isRecruitment, isFranchise, isMandatoryFilled, handleFilterChange }) => {
  const buildIndustryGroups = (opts) => {
    const groupMap = {};
    const assignedValues = new Set();
    const sortedOpts = [...opts].sort((a, b) => a.label.length - b.label.length);
    sortedOpts.forEach(parent => {
      const parentKey = parent.label.toLowerCase();
      const children = sortedOpts.filter(child => {
        if (child.value === parent.value) return false;
        const childKey = child.label.toLowerCase();
        return (
          childKey.startsWith(parentKey + ' / ') ||
          childKey.startsWith(parentKey + ' - ') ||
          childKey.startsWith(parentKey + ', ')
        );
      });
      if (children.length >= 1 && !assignedValues.has(parent.value)) {
        groupMap[parent.label] = { items: [parent, ...children] };
        assignedValues.add(parent.value);
        children.forEach(child => assignedValues.add(child.value));
      }
    });
    const ungrouped = opts.filter(opt => !assignedValues.has(opt.value));
    return { groupMap, ungrouped };
  };

  const { groupMap: indGroupMap, ungrouped: indUngrouped } = buildIndustryGroups(industries);
  const [isIndDropdownOpen, setIsIndDropdownOpen] = React.useState(false);
  const [expandedIndGroups, setExpandedIndGroups] = React.useState({});
  const [indSearch, setIndSearch] = React.useState('');
  const indDropdownRef = React.useRef(null);

  // pending = local checkbox state before Apply
  const [pendingIndustries, setPendingIndustries] = React.useState(industry || []);

  // keep pending in sync when dropdown is closed externally
  React.useEffect(() => {
    if (!isIndDropdownOpen) setPendingIndustries(industry || []);
  }, [industry, isIndDropdownOpen]);

  React.useEffect(() => {
    const handler = (e) => {
      if (indDropdownRef.current && !indDropdownRef.current.contains(e.target))
        setIsIndDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isDisabled = isOptionsLoading || industries.length === 0 || ((isRecruitment || isFranchise) && !isMandatoryFilled());

  const isGroupFullyChecked = (items) => items.every(item => pendingIndustries.includes(item.value));
  const isGroupPartiallyChecked = (items) =>
    items.some(item => pendingIndustries.includes(item.value)) && !isGroupFullyChecked(items);
  const toggleGroupSelection = (items) => {
    if (isGroupFullyChecked(items))
      setPendingIndustries(pendingIndustries.filter(v => !items.find(i => i.value === v)));
    else
      setPendingIndustries([...pendingIndustries, ...items.map(i => i.value).filter(v => !pendingIndustries.includes(v))]);
  };
  const toggleItem = (value) => {
    if (pendingIndustries.includes(value))
      setPendingIndustries(pendingIndustries.filter(v => v !== value));
    else
      setPendingIndustries([...pendingIndustries, value]);
  };

  const filteredGroups = Object.entries(indGroupMap).filter(([groupLabel, { items }]) =>
    !indSearch || groupLabel.toLowerCase().includes(indSearch.toLowerCase()) ||
    items.some(i => i.label.toLowerCase().includes(indSearch.toLowerCase()))
  );
  const filteredUngrouped = indUngrouped.filter(opt =>
    !indSearch || opt.label.toLowerCase().includes(indSearch.toLowerCase())
  );

  return (
    <div className="relative" ref={indDropdownRef}>
      <label className="block mb-1 text-sm font-semibold text-gray-700 flex items-center justify-between">
        <span>Industry (Multi-Select)</span>
        {industry.length > 0 && (
          <button onClick={() => { handleFilterChange('industry', []); setPendingIndustries([]); setIsIndDropdownOpen(false); }}
            className="text-xs text-gray-500 hover:text-red-600 transition-colors flex items-center gap-1">
            <X className="w-3 h-3" /> Clear All
          </button>
        )}
      </label>

      {/* Trigger box */}
      <div
        onClick={() => !isDisabled && setIsIndDropdownOpen(!isIndDropdownOpen)}
        className={`w-full min-h-[40px] border rounded-lg px-3 py-2 flex items-center justify-between
          ${isDisabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'bg-white cursor-pointer'}
          ${isIndDropdownOpen ? 'border-[#6B4FA1] ring-1 ring-[#6B4FA1]' : 'border-[#D6CDEA]'}`}
      >
        <div className="flex flex-wrap gap-1 flex-1">
          {industry.length > 0 ? industry.map((value, idx) => {
            const option = industries.find(d => d.value === value);
            return (
              <span key={idx} className="bg-[#E0D7F3] text-[#4B2E83] px-2 py-0.5 rounded text-sm flex items-center gap-1">
                {option ? option.label : value}
                <button onClick={(e) => { e.stopPropagation(); const n = industry.filter(v => v !== value); handleFilterChange('industry', n); setPendingIndustries(n); }} className="hover:text-red-600">
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          }) : (
            <span className="text-[#6B4FA1] text-sm">
              {isOptionsLoading ? 'Loading...' : industries.length === 0 ? 'No industries found' : 'Select Industries...'}
            </span>
          )}
        </div>
        <svg className={`w-4 h-4 flex-shrink-0 ml-2 transition-transform ${isIndDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Dropdown panel */}
      {isIndDropdownOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden" style={{ minWidth: '260px' }}>
          <div className="p-2 border-b border-gray-200">
            <input type="text" placeholder="Search industries..." value={indSearch}
              onChange={e => setIndSearch(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#4B2E83]" />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filteredGroups.length === 0 && filteredUngrouped.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">No industries found</div>
            ) : (
              <>
                {filteredGroups.map(([groupLabel, { items }]) => {
                  const fullyChecked = isGroupFullyChecked(items);
                  const partial = isGroupPartiallyChecked(items);
                  const isOpen = expandedIndGroups[groupLabel];
                  const visibleChildren = indSearch ? items.filter(i => i.label.toLowerCase().includes(indSearch.toLowerCase())) : items;
                  return (
                    <div key={groupLabel}>
                      <div className="flex items-center px-3 py-2 bg-gray-50 hover:bg-[#EDE7F6] cursor-pointer border-b border-gray-100">
                        <input type="checkbox" checked={fullyChecked}
                          ref={el => { if (el) el.indeterminate = partial; }}
                          onChange={() => toggleGroupSelection(items)}
                          className="w-4 h-4 text-[#4B2E83] rounded border-gray-300 focus:ring-[#4B2E83]"
                          onClick={e => e.stopPropagation()} />
                        <span className="ml-3 text-sm font-semibold text-[#4B2E83] flex-1"
                          onClick={() => setExpandedIndGroups(prev => ({ ...prev, [groupLabel]: !prev[groupLabel] }))}>
                          {groupLabel}<span className="ml-1 text-xs font-normal text-gray-400">({items.length})</span>
                        </span>
                        <span onClick={() => setExpandedIndGroups(prev => ({ ...prev, [groupLabel]: !prev[groupLabel] }))}
                          className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
                      </div>
                      {(isOpen || indSearch) && visibleChildren.map(opt => (
                        <label key={opt.value} className="flex items-center pl-8 pr-3 py-1.5 hover:bg-[#EDE7F6] cursor-pointer border-b border-gray-50">
                          <input type="checkbox" checked={pendingIndustries.includes(opt.value)}
                            onChange={() => toggleItem(opt.value)}
                            className="w-4 h-4 text-[#4B2E83] rounded border-gray-300 focus:ring-[#4B2E83]" />
                          <span className="ml-3 text-sm text-gray-600">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  );
                })}
                {filteredUngrouped.map(opt => (
                  <label key={opt.value} className="flex items-center px-3 py-2 hover:bg-[#EDE7F6] cursor-pointer border-b border-gray-50">
                    <input type="checkbox" checked={pendingIndustries.includes(opt.value)}
                      onChange={() => toggleItem(opt.value)}
                      className="w-4 h-4 text-[#4B2E83] rounded border-gray-300 focus:ring-[#4B2E83]" />
                    <span className="ml-3 text-sm text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </>
            )}
          </div>
          {/* Apply / Cancel footer */}
          <div className="border-t border-gray-200 p-2 flex gap-2 bg-gray-50">
            <button onClick={() => { handleFilterChange('industry', pendingIndustries); setIsIndDropdownOpen(false); }}
              className="flex-1 px-3 py-1.5 rounded-md text-sm font-medium bg-[#4B2E83] text-white hover:bg-[#3a2366] transition-colors">
              Apply {pendingIndustries.length > 0 && `(${pendingIndustries.length})`}
            </button>
            <button onClick={() => { setPendingIndustries(industry); setIsIndDropdownOpen(false); }}
              className="flex-1 px-3 py-1.5 rounded-md text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── DesignationFilter component ─────────────────────────────────────────────
const DesignationFilter = ({ designations, designation, pendingDesignations, setPendingDesignations,
  isDesignationDropdownOpen, setIsDesignationDropdownOpen, designationDropdownRef,
  isOptionsLoading, isRecruitment, isFranchise, isMandatoryFilled, handleFilterChange }) => {

  const buildGroups = (opts) => {
    const stem = (word) => {
      const w = word.toLowerCase();
      if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
      if (w.endsWith('es') && w.length > 4) return w.slice(0, -2);
      if (w.endsWith('s') && w.length > 3 && !w.endsWith('ss')) return w.slice(0, -1);
      return w;
    };
    const stemLabel = (label) => label.split(' ').map(stem).join(' ');
    const prefixCounts = {};
    opts.forEach(opt => {
      const words = opt.label.split(' ');
      for (let len = 1; len < words.length; len++) {
        const prefix = stemLabel(words.slice(0, len).join(' '));
        prefixCounts[prefix] = (prefixCounts[prefix] || 0) + 1;
      }
    });
    const singleWordStemCounts = {};
    opts.forEach(opt => {
      const firstStem = stem(opt.label.split(' ')[0]);
      singleWordStemCounts[firstStem] = (singleWordStemCounts[firstStem] || 0) + 1;
    });
    const stemGroupMap = {};
    const assignedValues = new Set();
    opts.forEach(opt => {
      const words = opt.label.split(' ');
      const firstStem = stem(words[0]);
      if (singleWordStemCounts[firstStem] >= 2) {
        if (!stemGroupMap[firstStem]) stemGroupMap[firstStem] = { displayName: words[0], items: [] };
        const current = stemGroupMap[firstStem].displayName;
        if (opt.label.split(' ').length === 1 && opt.label.length < current.length)
          stemGroupMap[firstStem].displayName = opt.label;
        stemGroupMap[firstStem].items.push(opt);
        assignedValues.add(opt.value);
        return;
      }
      let bestPrefix = null;
      for (let len = 1; len < words.length; len++) {
        const prefix = stemLabel(words.slice(0, len).join(' '));
        if ((prefixCounts[prefix] || 0) >= 2) { bestPrefix = prefix; break; }
      }
      if (bestPrefix) {
        if (!stemGroupMap[bestPrefix])
          stemGroupMap[bestPrefix] = { displayName: words.slice(0, bestPrefix.split(' ').length).join(' '), items: [] };
        stemGroupMap[bestPrefix].items.push(opt);
        assignedValues.add(opt.value);
      }
    });
    const finalGroupMap = {};
    Object.keys(stemGroupMap).forEach(key => {
      const keyWords = key.split(' ');
      let absorbed = false;
      for (let len = 1; len < keyWords.length; len++) {
        const shorterKey = keyWords.slice(0, len).join(' ');
        if (stemGroupMap[shorterKey]) { stemGroupMap[shorterKey].items.push(...stemGroupMap[key].items); absorbed = true; break; }
      }
      if (!absorbed) finalGroupMap[key] = stemGroupMap[key];
    });
    Object.keys(finalGroupMap).forEach(key => {
      if (finalGroupMap[key].items.length < 2) {
        finalGroupMap[key].items.forEach(opt => assignedValues.delete(opt.value));
        delete finalGroupMap[key];
      }
    });
    const groupMap = {};
    Object.values(finalGroupMap).forEach(({ displayName, items }) => { groupMap[displayName] = items; });
    return { groupMap, ungrouped: opts.filter(opt => !assignedValues.has(opt.value)) };
  };

  const { groupMap, ungrouped } = buildGroups(designations);
  const [desigSearch, setDesigSearch] = React.useState('');
  const [expandedGroups, setExpandedGroups] = React.useState({});

  const toggleGroup = (prefix) => setExpandedGroups(prev => ({ ...prev, [prefix]: !prev[prefix] }));
  const isGroupFullyChecked = (items) => items.every(item => pendingDesignations.includes(item.value));
  const isGroupPartiallyChecked = (items) =>
    items.some(item => pendingDesignations.includes(item.value)) && !isGroupFullyChecked(items);
  const toggleGroupSelection = (items) => {
    if (isGroupFullyChecked(items))
      setPendingDesignations(pendingDesignations.filter(v => !items.find(i => i.value === v)));
    else
      setPendingDesignations([...pendingDesignations, ...items.map(i => i.value).filter(v => !pendingDesignations.includes(v))]);
  };

  const filteredGroups = Object.entries(groupMap).filter(([prefix, items]) =>
    !desigSearch || prefix.toLowerCase().includes(desigSearch.toLowerCase()) ||
    items.some(i => i.label.toLowerCase().includes(desigSearch.toLowerCase()))
  );
  const filteredUngrouped = ungrouped.filter(opt =>
    !desigSearch || opt.label.toLowerCase().includes(desigSearch.toLowerCase())
  );

  return (
    <div className="relative" ref={designationDropdownRef}>
      <label className="block mb-1 text-sm font-semibold text-gray-700 flex items-center justify-between">
        <span>Designation (Multi-Select)</span>
        {designation.length > 0 && (
          <button onClick={() => { handleFilterChange('designation', []); setPendingDesignations([]); setIsDesignationDropdownOpen(false); }}
            className="text-xs text-gray-500 hover:text-red-600 transition-colors flex items-center gap-1">
            <X className="w-3 h-3" /> Clear All
          </button>
        )}
      </label>
      <div
        onClick={() => !((isRecruitment || isFranchise) && !isMandatoryFilled()) && setIsDesignationDropdownOpen(!isDesignationDropdownOpen)}
        className={`w-full min-h-[40px] border rounded-lg px-3 py-2 cursor-pointer flex items-center justify-between ${
          isDesignationDropdownOpen ? 'border-[#6B4FA1] ring-1 ring-[#6B4FA1]' : 'border-[#D6CDEA]'
        } ${((isRecruitment || isFranchise) && !isMandatoryFilled()) ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
      >
        <div className="flex flex-wrap gap-1">
          {designation.length > 0 ? designation.map((value, idx) => {
            const option = designations.find(d => d.value === value);
            return (
              <span key={idx} className="bg-[#E0D7F3] text-[#4B2E83] px-2 py-0.5 rounded text-sm flex items-center gap-1">
                {option ? option.label : value}
                <button onClick={(e) => { e.stopPropagation(); const n = designation.filter(v => v !== value); handleFilterChange('designation', n); setPendingDesignations(n); }} className="hover:text-red-600">
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          }) : (
            <span className="text-gray-400 text-sm">
              {isOptionsLoading ? 'Loading...' : designations.length === 0 ? 'No designations found' : 'Select designations...'}
            </span>
          )}
        </div>
        <svg className={`w-4 h-4 flex-shrink-0 transition-transform ${isDesignationDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {isDesignationDropdownOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-200">
            <input type="text" placeholder="Search designations..." value={desigSearch}
              onChange={e => setDesigSearch(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#4B2E83]" />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filteredGroups.length === 0 && filteredUngrouped.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">No designations found</div>
            ) : (
              <>
                {filteredGroups.map(([prefix, items]) => {
                  const fullyChecked = isGroupFullyChecked(items);
                  const partial = isGroupPartiallyChecked(items);
                  const isOpen = expandedGroups[prefix];
                  const visibleChildren = desigSearch ? items.filter(i => i.label.toLowerCase().includes(desigSearch.toLowerCase())) : items;
                  return (
                    <div key={prefix}>
                      <div className="flex items-center px-3 py-2 bg-gray-50 hover:bg-[#EDE7F6] cursor-pointer border-b border-gray-100">
                        <input type="checkbox" checked={fullyChecked}
                          ref={el => { if (el) el.indeterminate = partial; }}
                          onChange={() => toggleGroupSelection(items)}
                          className="w-4 h-4 text-[#4B2E83] rounded border-gray-300 focus:ring-[#4B2E83]"
                          onClick={e => e.stopPropagation()} />
                        <span className="ml-3 text-sm font-semibold text-[#4B2E83] flex-1" onClick={() => toggleGroup(prefix)}>
                          {prefix}<span className="ml-1 text-xs font-normal text-gray-400">({items.length})</span>
                        </span>
                        <span onClick={() => toggleGroup(prefix)} className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
                      </div>
                      {(isOpen || desigSearch) && visibleChildren.map(opt => (
                        <label key={opt.value} className="flex items-center pl-8 pr-3 py-1.5 hover:bg-[#EDE7F6] cursor-pointer">
                          <input type="checkbox" checked={pendingDesignations.includes(opt.value)}
                            onChange={() => {
                              if (pendingDesignations.includes(opt.value))
                                setPendingDesignations(pendingDesignations.filter(v => v !== opt.value));
                              else setPendingDesignations([...pendingDesignations, opt.value]);
                            }}
                            className="w-4 h-4 text-[#4B2E83] rounded border-gray-300 focus:ring-[#4B2E83]" />
                          <span className="ml-3 text-sm text-gray-600">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  );
                })}
                {filteredUngrouped.map(opt => (
                  <label key={opt.value} className="flex items-center px-3 py-2 hover:bg-[#EDE7F6] cursor-pointer border-b border-gray-50">
                    <input type="checkbox" checked={pendingDesignations.includes(opt.value)}
                      onChange={() => {
                        if (pendingDesignations.includes(opt.value))
                          setPendingDesignations(pendingDesignations.filter(v => v !== opt.value));
                        else setPendingDesignations([...pendingDesignations, opt.value]);
                      }}
                      className="w-4 h-4 text-[#4B2E83] rounded border-gray-300 focus:ring-[#4B2E83]" />
                    <span className="ml-3 text-sm text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </>
            )}
          </div>
          <div className="border-t border-gray-200 p-2 flex gap-2 bg-gray-50">
            <button onClick={() => { handleFilterChange('designation', pendingDesignations); setIsDesignationDropdownOpen(false); }}
              className="flex-1 px-3 py-1.5 rounded-md text-sm font-medium bg-[#4B2E83] text-white hover:bg-[#3a2366] transition-colors">
              Apply {pendingDesignations.length > 0 && `(${pendingDesignations.length})`}
            </button>
            <button onClick={() => { setPendingDesignations(designation); setIsDesignationDropdownOpen(false); }}
              className="flex-1 px-3 py-1.5 rounded-md text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
const AdvancedFilterPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const initialUserInfo = getOrCreateUserInfo();
  
  const [userInfo, setUserInfo] = useState(initialUserInfo);
  const [userId, setUserId] = useState(initialUserInfo.userId);
  const [userName, setUserName] = useState(initialUserInfo.userName);
  
  const isBusinessDev = initialUserInfo.department.toLowerCase().includes('business development');
  const isRecruitment = initialUserInfo.department.toLowerCase().includes('recruitment');
  const isFranchise = initialUserInfo.department.toLowerCase().includes('franchise');
  const isAdmin = initialUserInfo.department.toLowerCase().includes('admin') || 
                 userName.toLowerCase().includes('admin') || 
                 initialUserInfo.department === 'Admin';

  const canSeeBDViews = isBusinessDev || isAdmin;
  const canTrackBDViews = isBusinessDev;

  const [filters, setFilters] = useState({
    location: '',
    gender: '',
    industry: [],   // ← array now
    company: '',
    designation: [], // MULTI-SELECT - array
    ageRange: '', 
    education: '', 
    experienceRange: '', 
    salaryRange: '',
  });
  
  // Active frontend filters flag
  const hasActiveFilters = [
    filters.location,
    filters.gender,
    filters.industry,
    filters.company,
    filters.designation,
    filters.ageRange,
    filters.education,
    filters.experienceRange,
    filters.salaryRange
  ].some(v => Array.isArray(v) ? v.length > 0 : v !== '' && v != null);
  
  const [nameSearch, setNameSearch] = useState('');
  const [gotoPage, setGotoPage] = useState(''); // New state for Go to Page
  
  const [options, setOptions] = useState({
    locations: [], genders: [], industries: [], companies: [], designations: [],
    ageRanges: [], educations: [], experienceRanges: [], salaryRanges: []
  });

  const [results, setResults] = useState([]); 
  const [totalResults, setTotalResults] = useState(0); 
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [viewedStatus, setViewedStatus] = useState({});
  
  const [isLoading, setIsLoading] = useState(false); 
  const [isOptionsLoading, setIsOptionsLoading] = useState(false); 
  const [exporting, setExporting] = useState(false);
  const [markingViewed, setMarkingViewed] = useState({});
  
  const [pendingSort, setPendingSort] = useState(null);
  const [showMandatoryWarning, setShowMandatoryWarning] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [noDataMessage, setNoDataMessage] = useState('');
  
  // Multi-select designation states
  const [pendingDesignations, setPendingDesignations] = useState([]);
  const [isDesignationDropdownOpen, setIsDesignationDropdownOpen] = useState(false);
  const designationDropdownRef = useRef(null);
  
  const pageSize = 10; 

const isInitialMount = useRef(true);
const lastFiltersRef = useRef(JSON.stringify(filters));
const fetchInProgressRef = useRef(false);
const lastSearchTermRef = useRef('');
const searchInProgressRef = useRef(false); // ADD THIS

  const { location, gender, industry, company, designation, ageRange, education, experienceRange, salaryRange } = filters;
  const { locations, genders, industries, companies, designations, educations, salaryRanges, ageRanges, experienceRanges } = options;

  const selectStyles = {
    control: (base, state) => ({ 
        ...base, 
        minHeight: 40, 
        borderColor: state.isFocused ? '#6B4FA1' : '#D6CDEA', 
        boxShadow: state.isFocused ? '0 0 0 1px #6B4FA1' : 'none', 
        '&:hover': { borderColor: state.isFocused ? '#6B4FA1' : '#B7A8D9' } 
    }),
    placeholder: (base) => ({ ...base, color: '#6B4FA1' }),
    singleValue: (base) => ({ ...base, color: '#4B2E83' }),
    option: (base, state) => ({
      ...base,
      color: state.isSelected ? '#fff' : '#4B2E83',
      backgroundColor: state.isSelected ? '#4B2E83' : state.isFocused ? '#EDE7F6' : '#fff',
      '&:active': { backgroundColor: '#4B2E83' },
    }),
    menu: (base) => ({ ...base, zIndex: 9999 }),
  };

  // Click outside handler for designation dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (designationDropdownRef.current && !designationDropdownRef.current.contains(event.target)) {
        setIsDesignationDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const checkUserInfo = () => {
      const currentInfo = getOrCreateUserInfo();
      if (currentInfo.userId !== userId || currentInfo.userName !== userName) {
        setUserId(currentInfo.userId);
        setUserName(currentInfo.userName);
        setUserInfo(currentInfo);
      }
    };
    
    checkUserInfo();
    const interval = setInterval(checkUserInfo, 3000);
    return () => clearInterval(interval);
  }, [userId, userName]);
  // ── Cross-app auth from Sarthi360 ──
  // When ?xtoken= is present, validate it with SarthiIQ backend, receive a real
  // SarthiIQ session JWT + user object, and store everything exactly the same way
  // a normal login does — so the user is fully authenticated, not just "guest".
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const xtoken = params.get('xtoken');
  if (!xtoken) return;

  const verifyToken = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:3001';
      const res = await fetch(`${baseUrl}/api/cross-auth?token=${encodeURIComponent(xtoken)}`);

      if (!res.ok) {
        console.warn('Cross-auth failed with status', res.status, '— continuing as guest');
        return;
      }

      const data = await res.json();

      // ── Store session exactly like a normal SarthiIQ login ──────────────────
      // `data.token`  — SarthiIQ JWT (minted for this user by crossAuth.js)
      // `data.user`   — { id, name, email, department, role }
      // `data.department` / `data.userName` — convenience fields for getOrCreateUserInfo()

      if (data.token) {
        localStorage.setItem('token', data.token);
      }

      if (data.user) {
        // Store the full user object (mirrors how your normal login flow works)
        localStorage.setItem('user', JSON.stringify(data.user));

        // Individual keys read by getOrCreateUserInfo() helper above
        if (data.user.id)         localStorage.setItem('userId',      String(data.user.id));
        if (data.user.name)       localStorage.setItem('userFullName', data.user.name);
        if (data.user.department) localStorage.setItem('userDept',     data.user.department);
      } else {
        // Fallback: backend returned old-style flat response
        if (data.department) localStorage.setItem('userDept',     data.department);
        if (data.userName)   localStorage.setItem('userFullName', data.userName);
      }

      // Re-hydrate component state so UI reflects the logged-in user immediately
      // without requiring a page refresh.
      const updatedInfo = getOrCreateUserInfo();
      setUserId(updatedInfo.userId);
      setUserName(updatedInfo.userName);
      setUserInfo(updatedInfo);

      // Clean xtoken from URL so it doesn't leak in browser history / copy-paste
      const cleanParams = new URLSearchParams(window.location.search);
      cleanParams.delete('xtoken');
      window.history.replaceState({}, '', `/advanced-filter?${cleanParams.toString()}`);

    } catch (err) {
      console.warn('Cross-auth failed, continuing as guest:', err.message);
    }
  };

  verifyToken();
}, []);
// ── Deep-link from Sarthi360: read ?designation=X&autoSearch=true ──
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const designationParam = params.get('designation');
  const shouldAutoSearch = params.get('autoSearch') === 'true';

  if (!designationParam || !designationParam.trim()) return;

  // Pre-fill the designation filter chip
  setFilters(prev => ({
    ...prev,
    designation: [designationParam.trim()],
  }));

  if (!shouldAutoSearch) return;

  // Wait for options to load, then fire the search directly
  const timer = setTimeout(async () => {
    setIsLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:3001';
      const res = await fetch(`${baseUrl}/api/filters/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designation: [designationParam.trim()],
          department: initialUserInfo.department,
          sort: 'name_asc',
          page: 1,
          pageSize: pageSize,
        }),
      });
      const data = await res.json();
      setResults(Array.isArray(data.results) ? data.results : []);
      setTotalResults(data.totalCount || 0);
      setHasSearched(true);
      setCurrentPage(1);
    } catch (err) {
      console.error('Auto-search from deep-link failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, 900); // wait for fetchInitialOptions to finish first

  return () => clearTimeout(timer);
}, []); 

  // ============================================
  // FIXED: fetchInitialOptions defined first
  // ============================================
  const fetchInitialOptions = async () => {
    if (fetchInProgressRef.current || isOptionsLoading) return;
    
    fetchInProgressRef.current = true;
    setIsOptionsLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:3001';
      const url = `${baseUrl}/api/filters/options?department=${encodeURIComponent(initialUserInfo.department)}`;
      
      const response = await fetch(url);
      
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      
      const data = await response.json();
      
      const genderOptions = data.genders && data.genders.length > 0 
        ? (data.genders.includes('Both') ? data.genders : ['Both', ...data.genders])
        : ['Both'];
      
      setOptions(prev => ({
        ...prev,
        locations: normalizeOptions([{ label: 'All Locations', value: '__ALL__' }, ...(data.locations || [])]),
        genders: normalizeOptions(genderOptions),
        industries: normalizeOptions(data.industries || []),
        companies: normalizeOptions(data.companies || []),
        designations: normalizeOptions(data.designations || []),
        ageRanges: normalizeOptions(data.ageRanges || []),
        educations: normalizeOptions(data.educations || []),
        experienceRanges: normalizeOptions(data.experienceRanges || []),
        salaryRanges: normalizeOptions(data.salaryRanges || []),
      }));
      
    } catch (err) {
      console.error('❌ Fetch initial options error:', err);
      setOptions(prev => ({
        ...prev,
        genders: normalizeOptions(['Both'])
      }));
    } finally {
      setIsOptionsLoading(false);
      fetchInProgressRef.current = false;
    }
  };

  const fetchCascadingOptions = useCallback(async (currentFilters = {}) => {
    if (fetchInProgressRef.current || isOptionsLoading) return;
    
    fetchInProgressRef.current = true;
    setIsOptionsLoading(true);
    
    try {
      const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:3001';
      const url = `${baseUrl}/api/filters/cascading-options`;
      
     const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    appliedFilters: {
      ...currentFilters,
      location: currentFilters.location === '__ALL__' ? undefined : currentFilters.location,
    },
    department: initialUserInfo.department
  }),
});
      
      if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
      
      const data = await res.json();
      
      const genderOptions = data.genders && data.genders.length > 0 
        ? (data.genders.includes('Both') ? data.genders : ['Both', ...data.genders])
        : ['Both'];
      
      setOptions(prev => ({
        ...prev,
        locations: normalizeOptions([{ label: 'All Locations', value: '__ALL__' }, ...(data.locations || [])]),
        genders: normalizeOptions(genderOptions),
        industries: normalizeOptions(data.industries || []),
        companies: normalizeOptions(data.companies || []),
        designations: normalizeOptions(data.designations || []),
        ageRanges: normalizeOptions(data.ageRanges || []),
        educations: normalizeOptions(data.educations || []),
        experienceRanges: normalizeOptions(data.experienceRanges || []),
        salaryRanges: normalizeOptions(data.salaryRanges || []),
      }));
      
    } catch (err) {
      console.error('❌ Fetch cascading options error:', err);
      await fetchInitialOptions();
    } finally {
      setIsOptionsLoading(false);
      fetchInProgressRef.current = false;
    }
  }, [initialUserInfo.department, isOptionsLoading]);

  useEffect(() => { 
    fetchInitialOptions();
  }, []);

  // Sync pending designations with actual designations
 useEffect(() => {
    if (!isDesignationDropdownOpen) {
      setPendingDesignations(designation);
    }
  }, [designation, isDesignationDropdownOpen]);



  const handleFilterChange = (key, value) => {
    let finalValue;
    
    if (key === 'designation') {
      // Designation is multi-select - keep as array
      finalValue = value || [];
    } else {
      if (value === null || value === undefined) {
        finalValue = '';
      } else if (typeof value === 'object' && value?.value) {
        finalValue = value.value;
      } else {
        finalValue = value;
      }
    }
    
    setFilters(prev => ({ ...prev, [key]: finalValue }));
    setCurrentPage(1);
  };

 const handleNameSearchChange = (e) => {
  const val = e.target.value;
  setNameSearch(val);
  if (hasSearched) {
    clearTimeout(window._nameSearchTimer);
    window._nameSearchTimer = setTimeout(() => {
      executeSearch(pendingSort || 'experience_desc', 1, val);
    }, 500);
  }
};

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      executeSearch(pendingSort || 'experience_desc', 1);
    }
  };

  const markProfileAsViewed = async (profileId) => {
    if (!canTrackBDViews || !profileId) return;
    
    setMarkingViewed(prev => ({ ...prev, [profileId]: true }));
    
    try {
      const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:3001';
      
      const res = await fetch(`${baseUrl}/api/filters/mark-viewed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          profileId: String(profileId),
          userId: String(userId),
          userName: userName,
          department: initialUserInfo.department
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        
        setViewedStatus(prev => ({
          ...prev,
          [profileId]: {
            viewed_by_user_id: data.viewed_by_user_id || userId,
            viewed_by_name: data.viewed_by_name || userName,
            viewed_at: data.viewed_at || new Date().toISOString(),
            viewer_department: data.viewer_department || initialUserInfo.department,
            is_current_user: data.is_current_user || true,
            total_views: data.total_views || 1
          }
        }));
        
        if (results.length > 0) {
          const profileIds = results.map(row => row.id).filter(id => id);
          await fetchViewedStatus(profileIds);
        }
      }
    } catch (err) {
      console.warn('❌ Error marking profile as viewed:', err);
    } finally {
      setMarkingViewed(prev => ({ ...prev, [profileId]: false }));
    }
  };

  const fetchViewedStatus = useCallback(async (profileIds) => {
    if (!canSeeBDViews || !profileIds || profileIds.length === 0) return;
    
    try {
      const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:3001';
      const res = await fetch(`${baseUrl}/api/filters/viewed-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          profileIds: profileIds.map(id => String(id)),
          userId: String(userId),
          userName: userName
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setViewedStatus(prev => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.warn('❌ Error fetching viewed status:', err);
    }
  }, [canSeeBDViews, userId, userName]);

 const executeSearch = useCallback(async (sortValue, pageNum = 1, overrideNameSearch = null) => { 
    if (searchInProgressRef.current) return;
    
    searchInProgressRef.current = true;
    setIsLoading(true);
    setNoDataMessage('');
    
    try {
   const activeNameSearch = overrideNameSearch !== null ? overrideNameSearch : nameSearch;
const searchPayload = { 
  nameSearch: activeNameSearch && activeNameSearch.trim() ? activeNameSearch.trim() : undefined,
  location: location === '__ALL__' ? undefined : (location || undefined),
       gender: gender && gender !== 'Both' ? [gender] : undefined,
        industry: industry && industry.length > 0 ? industry : undefined,
        company: company || undefined,
        designation: designation.length > 0 ? designation : undefined, // Send array for multi-select
        ageRange: ageRange || undefined,
        education: education || undefined,
        experienceRange: experienceRange || undefined,
        salaryRange: salaryRange || undefined,
        department: initialUserInfo.department, 
        sort: sortValue, 
        page: pageNum, 
        pageSize: pageSize 
      };
      
      const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:3001';
      const res = await fetch(`${baseUrl}/api/filters/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchPayload),
      });
      
      if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
      
      const data = await res.json();
      
      const resultsData = Array.isArray(data.results) ? data.results : [];
      setResults(resultsData);
      setTotalResults(data.totalCount || 0);
      setPendingSort(sortValue); 
      setHasSearched(true); 
      setCurrentPage(pageNum);
      
      // Set no data message if no results found
      if (resultsData.length === 0 && data.totalCount === 0) {
        const activeFilters = [];
        if (location) activeFilters.push('Location');
        if (gender && gender !== 'Both') activeFilters.push('Gender');
        if (industry && industry.length > 0) activeFilters.push(`Industry (${industry.length} selected)`);
        if (designation && designation.length > 0) activeFilters.push(`Designation (${designation.length} selected)`);
        if (ageRange) activeFilters.push('Age Range');
        if (education) activeFilters.push('Education');
        if (experienceRange) activeFilters.push('Experience');
        if (salaryRange) activeFilters.push('Salary');
        
        if (activeFilters.length > 0) {
          setNoDataMessage(`No profiles found matching your selected filters: ${activeFilters.join(', ')}. Try changing or removing some filters.`);
        } else {
          setNoDataMessage('No profiles found in the database. Please check back later.');
        }
      }
      
      if (canSeeBDViews && resultsData.length > 0) {
        const profileIds = resultsData.map(row => row.id).filter(id => id);
        await fetchViewedStatus(profileIds);
      }
      
    } catch (err) {
      console.error('❌ Search failed:', err);
      // alert('Search failed. Please try again.'); 
      setResults([]);
      setTotalResults(0);
      setNoDataMessage('An error occurred while searching. Please try again.');
    } finally {
      setIsLoading(false);
      searchInProgressRef.current = false;
    }
  }, [filters, initialUserInfo.department, pageSize, canSeeBDViews, userId, userName, location, gender, industry, company, designation, ageRange, education, experienceRange, salaryRange, nameSearch, fetchViewedStatus]); 

  // Real-time Debounced Search Logic
useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    const currentFiltersStr = JSON.stringify(filters);
    
    if (currentFiltersStr === lastFiltersRef.current) return;
    
    lastFiltersRef.current = currentFiltersStr;
    
    const timer = setTimeout(() => {
      const hasNonDesignationFilter =
        (filters.location && filters.location !== '__ALL__') || filters.gender || filters.industry ||
        filters.company || filters.ageRange || filters.education ||
        filters.experienceRange || filters.salaryRange;

      if (hasNonDesignationFilter) {
        fetchCascadingOptions(filters);
      } else if (!filters.designation || filters.designation.length === 0) {
        fetchInitialOptions();
      }

      // Auto-trigger search if user has already searched once
      if (hasSearched) {
        executeSearch(pendingSort || 'experience_desc', 1);
      }
    }, 800);
    
    return () => clearTimeout(timer);
  }, [filters, fetchCascadingOptions, hasSearched, executeSearch, pendingSort]);

  // New function for Go to Page functionality
  const handleGotoPage = () => {
    const pageNum = parseInt(gotoPage);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      executeSearch(pendingSort || 'experience_desc', pageNum);
      setGotoPage('');
    } else {
      alert(`Please enter a valid page number between 1 and ${totalPages}`);
    }
  };

  const handleSearch = () => {
    if (isRecruitment || isFranchise) {
      const missingFilters = [];
      if (!location) missingFilters.push('Location');
      if (!gender) missingFilters.push('Gender');
      
      if (missingFilters.length > 0) {
        setShowMandatoryWarning(true);
        setTimeout(() => setShowMandatoryWarning(false), 5000);
        return;
      }
    }
    
    setShowMandatoryWarning(false);
    executeSearch(pendingSort || 'name_asc', 1);
  };

  const handleSortChange = (option) => {
    const val = option?.value || null;
    setPendingSort(val);
    if(val && hasSearched) {
      executeSearch(val, currentPage);
    }
  };
  
  const handleClear = () => {
    setFilters({ 
      location: '',  
      gender: '',    
      industry: [],
      company: '',
      designation: [],
      ageRange: '', 
      education: '', 
      experienceRange: '', 
      salaryRange: '' 
    });
    setPendingDesignations([]);
    setResults([]);
    setTotalResults(0);
    setHasSearched(false);
    setPendingSort(null);
    setCurrentPage(1); 
    setViewedStatus({});
   setNameSearch('');
    lastSearchTermRef.current = '';
    setGotoPage('');
    setNoDataMessage('');
    fetchInitialOptions();
  };

  const handleExportToExcel = async () => {
    if (!hasSearched || totalResults === 0) {
      alert('Please search for results first before exporting.');
      return;
    }

    if (exporting) return;
    
    setExporting(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:3001';
      const res = await fetch(`${baseUrl}/api/filters/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nameSearch: nameSearch || undefined,
          location: location === '__ALL__' ? undefined : (location || undefined),
          gender: gender && gender !== 'Both' ? [gender] : undefined,
          industry: industry && industry.length > 0 ? industry : undefined,
          company: company || undefined,
          designation: designation.length > 0 ? designation : undefined,
          ageRange: ageRange || undefined,
          education: education || undefined,
          experienceRange: experienceRange || undefined,
          salaryRange: salaryRange || undefined,
          department: initialUserInfo.department, 
          sort: pendingSort || 'name_asc',
          userId: userId,
          userName: userName
        }),
      });
      
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `candidates_${initialUserInfo.department.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      alert(`Exported ${totalResults} candidates to Excel successfully!`);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleContactView = (profile) => {
    if (!profile || !profile.id) {
      alert('Cannot view contact: Profile information is incomplete.');
      return;
    }
  
    if (canTrackBDViews && profile.id) {
      markProfileAsViewed(profile.id);
    }
    setSelectedProfile(profile);
  };

  useEffect(() => {
    if (canSeeBDViews && results.length > 0 && hasSearched) {
      const refreshViewedStatus = async () => {
        const profileIds = results.map(row => row.id).filter(id => id);
        if (profileIds.length > 0) {
          await fetchViewedStatus(profileIds);
        }
      };
      
      const interval = setInterval(refreshViewedStatus, 30000);
      
      return () => clearInterval(interval);
    }
  }, [results, canSeeBDViews, hasSearched, fetchViewedStatus]);

 const safeResults = Array.isArray(results) ? results : [];
  const totalPages = Math.ceil(totalResults / pageSize);
  const indexOfFirstItem = totalResults === 0 ? 0 : (currentPage - 1) * pageSize;
  const indexOfLastItem = totalResults === 0 ? 0 : indexOfFirstItem + safeResults.length; 
  
  const nextPage = () => { 
    if(currentPage < totalPages) {
      executeSearch(pendingSort || 'name_asc', currentPage + 1);
    }
  };
  
  const prevPage = () => { 
    if(currentPage > 1) {
      executeSearch(pendingSort || 'name_asc', currentPage - 1);
    }
  };

  const getViewedStatus = (profileId) => {
    if (!canSeeBDViews) return null;
    return viewedStatus[profileId];
  };

  const isSearchEnabled = () => {
    if (isBusinessDev) return true;
    if (isRecruitment || isFranchise) return !!location && !!gender;
    return true;
  };

  const isMandatoryFilled = () => {
    if (isRecruitment || isFranchise) {
      return !!location && !!gender;
    }
    return true;
  };



const renderLocationFilter = () => (
  <div className="relative">
    <label className="block mb-1 text-sm font-semibold text-gray-700 flex items-center justify-between">
      <span>
        Location {(isRecruitment || isFranchise) && <span className="text-red-500 ml-1">*</span>}
        {!location && (isRecruitment || isFranchise) && (
          <span className="ml-2 text-xs text-red-400 font-normal">(Required)</span>
        )}
      </span>
      {location && (
        <button
          onClick={() => handleFilterChange('location', '')}
          className="text-xs text-gray-500 hover:text-red-600 transition-colors flex items-center gap-1"
        >
          <X className="w-3 h-3" /> Clear
        </button>
      )}
    </label>
    <Select
      styles={{
        ...selectStyles,
        control: (base, state) => ({
          ...base,
          minHeight: 40,
          borderColor: !location && (isRecruitment || isFranchise) ? '#fecaca' : (state.isFocused ? '#6B4FA1' : '#D6CDEA'),
          borderWidth: !location && (isRecruitment || isFranchise) ? '2px' : '1px',
        })
      }}
      options={locations}
      value={location ? { value: location, label: location === '__ALL__' ? 'All Locations' : location } : null}
      onChange={opt => {
        if (opt?.value === '__ALL__') {
          handleFilterChange('location', '__ALL__');
        } else {
          handleFilterChange('location', opt?.value ?? '');
        }
      }}
      placeholder={isOptionsLoading ? 'Loading...' : locations.length > 0 ? 'Select Location' : 'No locations found'}
      isLoading={isOptionsLoading}
      isDisabled={isOptionsLoading || locations.length === 0}
      noOptionsMessage={() => 'No locations available'}
    />
  </div>
);

  const renderGenderFilter = () => (
    <div className="relative">
      <label className="block mb-1 text-sm font-semibold text-gray-700 flex items-center justify-between">
        <span>
          Gender {(isRecruitment || isFranchise) && <span className="text-red-500 ml-1">*</span>}
          {!gender && (isRecruitment || isFranchise) && (
            <span className="ml-2 text-xs text-red-400 font-normal">(Required)</span>
          )}
        </span>
        {gender && (
          <button
            onClick={() => handleFilterChange('gender', '')}
            className="text-xs text-gray-500 hover:text-red-600 transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </label>
      <Select 
        styles={{
          ...selectStyles,
          control: (base, state) => ({
            ...base,
            minHeight: 40,
            borderColor: !gender && (isRecruitment || isFranchise) ? '#fecaca' : (state.isFocused ? '#6B4FA1' : '#D6CDEA'),
            borderWidth: !gender && (isRecruitment || isFranchise) ? '2px' : '1px',
          })
        }}
        options={genders} 
        value={gender ? { value: gender, label: gender } : null} 
        onChange={opt => handleFilterChange('gender', opt?.value ?? '')}
        placeholder={isOptionsLoading ? 'Loading...' : genders.length > 0 ? 'Select Gender' : 'No genders found'} 
        isLoading={isOptionsLoading} 
        isDisabled={isOptionsLoading || genders.length === 0} 
        noOptionsMessage={() => 'No genders available'} 
      />
    </div>
  );



  const renderCompanyFilter = () => {
    if (!isBusinessDev) return null;
    
    return (
      <div className="relative">
        <label className="block mb-1 text-sm font-semibold text-gray-700 flex items-center justify-between">
          <span>Current Company</span>
          {company && (
            <button
              onClick={() => handleFilterChange('company', '')}
              className="text-xs text-gray-500 hover:text-red-600 transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </label>
        <Select 
          styles={selectStyles} 
          options={companies} 
          value={company ? { value: company, label: company } : null} 
          onChange={opt => handleFilterChange('company', opt?.value ?? '')} 
          placeholder={isOptionsLoading ? 'Loading...' : companies.length > 0 ? 'Select Company' : 'No companies found'} 
          isLoading={isOptionsLoading} 
          isDisabled={isOptionsLoading || companies.length === 0} 
          noOptionsMessage={() => 'No companies available'} 
        />
      </div>
    );
  };

  const renderAgeRangeFilter = () => (
    <div className="relative">
      <label className="block mb-1 text-sm font-semibold text-gray-700 flex items-center justify-between">
        <span>Age Range</span>
        {ageRange && (
          <button
            onClick={() => handleFilterChange('ageRange', '')}
            className="text-xs text-gray-500 hover:text-red-600 transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </label>
      <Select 
        styles={selectStyles} 
        isClearable 
        options={ageRanges} 
        value={ageRanges.find(o => o.value === ageRange) || null} 
        onChange={opt => handleFilterChange('ageRange', opt?.value ?? '')} 
        placeholder={isOptionsLoading ? 'Loading...' : 'Any Age'} 
        isLoading={isOptionsLoading} 
        isDisabled={isOptionsLoading || ageRanges.length === 0 || ((isRecruitment || isFranchise) && !isMandatoryFilled())}
        noOptionsMessage={() => 'No age ranges available'} 
      />
    </div>
  );

  const renderEducationFilter = () => (
    <div className="relative">
      <label className="block mb-1 text-sm font-semibold text-gray-700 flex items-center justify-between">
        <span>Education</span>
        {education && (
          <button
            onClick={() => handleFilterChange('education', '')}
            className="text-xs text-gray-500 hover:text-red-600 transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </label>
      <Select 
        styles={selectStyles} 
        isClearable 
        options={educations} 
        value={educations.find(o => o.value === education) || null} 
        onChange={opt => handleFilterChange('education', opt?.value ?? '')} 
        placeholder={isOptionsLoading ? 'Loading...' : 'All Education'} 
        isLoading={isOptionsLoading} 
        isDisabled={isOptionsLoading || educations.length === 0 || ((isRecruitment || isFranchise) && !isMandatoryFilled())}
        noOptionsMessage={() => 'No education options available'} 
      />
    </div>
  );

  const renderExperienceFilter = () => (
    <div className="relative">
      <label className="block mb-1 text-sm font-semibold text-gray-700 flex items-center justify-between">
        <span>Experience</span>
        {experienceRange && (
          <button
            onClick={() => handleFilterChange('experienceRange', '')}
            className="text-xs text-gray-500 hover:text-red-600 transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </label>
      <Select 
        styles={selectStyles} 
        isClearable 
        options={experienceRanges} 
        value={experienceRanges.find(o => o.value === experienceRange) || null} 
        onChange={opt => handleFilterChange('experienceRange', opt?.value ?? '')} 
        placeholder={isOptionsLoading ? 'Loading...' : 'Any Experience'} 
        isLoading={isOptionsLoading} 
        isDisabled={isOptionsLoading || experienceRanges.length === 0 || ((isRecruitment || isFranchise) && !isMandatoryFilled())}
        noOptionsMessage={() => 'No experience ranges available'} 
      />
    </div>
  );

  const renderSalaryFilter = () => (
    <div className="relative">
      <label className="block mb-1 text-sm font-semibold text-gray-700 flex items-center justify-between">
        <span>Salary Range</span>
        {salaryRange && (
          <button
            onClick={() => handleFilterChange('salaryRange', '')}
            className="text-xs text-gray-500 hover:text-red-600 transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </label>
      <Select 
        styles={selectStyles} 
        isClearable 
        options={salaryRanges} 
        value={salaryRanges.find(o => o.value === salaryRange) || null} 
        onChange={opt => handleFilterChange('salaryRange', opt?.value ?? '')} 
        placeholder={isOptionsLoading ? 'Loading...' : 'All Salaries'} 
        isLoading={isOptionsLoading} 
        isDisabled={isOptionsLoading || salaryRanges.length === 0 || ((isRecruitment || isFranchise) && !isMandatoryFilled())}
        noOptionsMessage={() => 'No salary ranges available'} 
      />
    </div>
  );

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-[#4B2E83] hover:text-[#3a2366] text-sm font-medium mb-4 transition-colors">
        <img src={backIcon} alt="Back" className="w-4 h-4" /> Back to Dashboard
      </button>
      
      {/* MANDATORY WARNING MESSAGE */}
      {showMandatoryWarning && (
        <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg shadow-md animate-pulse">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">
                ⚠️ Please select the following mandatory filters before searching:
              </p>
              <ul className="mt-1 text-sm text-red-700 list-disc list-inside">
                {!location && <li>Location is required</li>}
                {!gender && <li>Gender is required</li>}
              </ul>
            </div>
            <button 
              onClick={() => setShowMandatoryWarning(false)}
              className="flex-shrink-0 text-red-500 hover:text-red-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      
      <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-[#4B2E83]">
        <h2 className="text-2xl font-bold mb-6 text-[#4B2E83] border-b pb-3">
          Advanced Profile Filter (
          {initialUserInfo.department === 'Franchise' ? 'Franchise Development' : 
           initialUserInfo.department === 'Recruitment' ? 'Recruitment (Franchise)' : 
           initialUserInfo.department}
          )
          {isAdmin && <span className="ml-2 text-sm bg-red-100 text-red-800 px-2 py-1 rounded">Admin</span>}
        </h2>
        
        {isOptionsLoading && (
          <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-lg flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading filter options...
          </div>
        )}
        
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
  {isBusinessDev ? (
    <>
      <IndustryFilter
        industries={industries}
        industry={industry}
        isOptionsLoading={isOptionsLoading}
        isRecruitment={isRecruitment}
        isFranchise={isFranchise}
        isMandatoryFilled={isMandatoryFilled}
        handleFilterChange={handleFilterChange}
      />
      <DesignationFilter
        designations={designations}
        designation={designation}
        pendingDesignations={pendingDesignations}
        setPendingDesignations={setPendingDesignations}
        isDesignationDropdownOpen={isDesignationDropdownOpen}
        setIsDesignationDropdownOpen={setIsDesignationDropdownOpen}
        designationDropdownRef={designationDropdownRef}
        isOptionsLoading={isOptionsLoading}
        isRecruitment={isRecruitment}
        isFranchise={isFranchise}
        isMandatoryFilled={isMandatoryFilled}
        handleFilterChange={handleFilterChange}
      />
      {renderLocationFilter()}
      {renderGenderFilter()}
      {renderCompanyFilter()}
    </>
  ) : isRecruitment || isFranchise ? (
    <>
      {renderLocationFilter()}
      {renderGenderFilter()}
      <IndustryFilter
        industries={industries}
        industry={industry}
        isOptionsLoading={isOptionsLoading}
        isRecruitment={isRecruitment}
        isFranchise={isFranchise}
        isMandatoryFilled={isMandatoryFilled}
        handleFilterChange={handleFilterChange}
      />
      <DesignationFilter
        designations={designations}
        designation={designation}
        pendingDesignations={pendingDesignations}
        setPendingDesignations={setPendingDesignations}
        isDesignationDropdownOpen={isDesignationDropdownOpen}
        setIsDesignationDropdownOpen={setIsDesignationDropdownOpen}
        designationDropdownRef={designationDropdownRef}
        isOptionsLoading={isOptionsLoading}
        isRecruitment={isRecruitment}
        isFranchise={isFranchise}
        isMandatoryFilled={isMandatoryFilled}
        handleFilterChange={handleFilterChange}
      />
      {renderAgeRangeFilter()}
      {renderEducationFilter()}
      {renderExperienceFilter()}
      {renderSalaryFilter()}
    </>
  ) : (
    <>
      {renderLocationFilter()}
      {renderGenderFilter()}
      <IndustryFilter
        industries={industries}
        industry={industry}
        isOptionsLoading={isOptionsLoading}
        isRecruitment={isRecruitment}
        isFranchise={isFranchise}
        isMandatoryFilled={isMandatoryFilled}
        handleFilterChange={handleFilterChange}
      />
      <DesignationFilter
        designations={designations}
        designation={designation}
        pendingDesignations={pendingDesignations}
        setPendingDesignations={setPendingDesignations}
        isDesignationDropdownOpen={isDesignationDropdownOpen}
        setIsDesignationDropdownOpen={setIsDesignationDropdownOpen}
        designationDropdownRef={designationDropdownRef}
        isOptionsLoading={isOptionsLoading}
        isRecruitment={isRecruitment}
        isFranchise={isFranchise}
        isMandatoryFilled={isMandatoryFilled}
        handleFilterChange={handleFilterChange}
      />
      {renderAgeRangeFilter()}
      {renderEducationFilter()}
      {renderExperienceFilter()}
      {renderSalaryFilter()}
    </>
  )}
</div>

        <div className="flex gap-4 mt-10 pt-4 border-t border-gray-100">
          <button 
            onClick={handleSearch} 
            disabled={isLoading || !isSearchEnabled() || isOptionsLoading || ((isRecruitment || isFranchise) && !isMandatoryFilled())} 
            className={`px-8 py-3 rounded-lg text-white font-semibold transition-all duration-200 shadow-md flex items-center justify-center gap-2 min-w-[160px] ${
              isLoading || !isSearchEnabled() || isOptionsLoading || ((isRecruitment || isFranchise) && !isMandatoryFilled())
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-[#4B2E83] hover:bg-[#3a2366] hover:shadow-lg'
            }`}
          >
            {isLoading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Searching...</>) : 'Apply Filters'}
          </button>
          <button onClick={handleClear} disabled={isOptionsLoading} className="px-8 py-3 rounded-lg bg-[#E0D7F3] text-[#4B2E83] font-semibold hover:bg-[#d0c7e8] transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed">Clear All</button>
        </div>
      </div>
      
      {hasSearched && (
        <div className="mt-8">
          <div className="flex flex-col md:flex-row justify-between items-center mb-4 p-4 bg-white rounded-xl shadow-lg border-t-4 border-gray-200 gap-4">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-bold text-gray-700">
                Results ({totalResults})
              </h3>
              
              {/* EXPORT TO EXCEL BUTTON */}
              <button
                onClick={handleExportToExcel}
                disabled={exporting || totalResults === 0}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  exporting || totalResults === 0
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {exporting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Exporting...</>
                ) : (
                  <><Download className="w-4 h-4" /> Export to Excel</>
                )}
              </button>
            </div>
            
            <div className="flex flex-1 max-w-4xl gap-3 items-center">
              {/* GO TO PAGE OPTION */}
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="number"
                  placeholder="Pg#"
                  className="w-16 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4B2E83] outline-none text-sm"
                  value={gotoPage}
                  onChange={(e) => setGotoPage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGotoPage()}
                />
                <button 
                  onClick={handleGotoPage}
                  className="px-3 py-2 bg-[#E0D7F3] text-[#4B2E83] rounded-lg hover:bg-[#d0c7e8] transition-colors font-semibold text-sm border border-[#D6CDEA]"
                >
                  Go
                </button>
              </div>

              {/* GLOBAL REAL-TIME SEARCH INPUT */}
              <div className="relative flex-1">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                   {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                </div>
                <input
                  type="text"
                  placeholder="Search name, location, designation, etc..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4B2E83] focus:border-transparent outline-none font-medium"
                  value={nameSearch}
                  onChange={handleNameSearchChange}
                />
              </div>

              {/* SORT DROPDOWN */}
              <div className="w-48">
                <Select 
                  styles={{
                    ...selectStyles,
                    menuPortal: (base) => ({ ...base, zIndex: 9999 })
                  }}
                  options={sortOptions} 
                  value={sortOptions.find(o => o.value === pendingSort)} 
                  onChange={handleSortChange} 
                  placeholder="Sort by..."
                  menuPortalTarget={document.body}
                />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg overflow-hidden border-t-4 border-gray-200">
            {noDataMessage ? (
              <div className="p-8 text-center">
                <div className="text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                  <svg className="w-12 h-12 mx-auto mb-3 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-lg font-semibold mb-2">No Results Found</p>
                  <p className="text-sm text-gray-600">{noDataMessage}</p>
                  <button 
                    onClick={handleClear}
                    className="mt-4 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                  >
                    Clear All Filters
                  </button>
                </div>
              </div>
            ) : totalResults === 0 ? (
              <div className="p-8 text-center text-gray-500 text-base">
                <div className="text-gray-400 mb-2">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                😔 No profiles found matching your current filter criteria.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#E0D7F3] text-[#4B2E83] uppercase font-bold text-xs">
                      <tr>
                        <th className="p-4 border-b">Name</th>
                        <th className="p-4 border-b">Age</th>
                        <th className="p-4 border-b">Gender</th>
                        <th className="p-4 border-b">Location</th>
                        <th className="p-4 border-b">Designation</th>
                        {isBusinessDev && <th className="p-4 border-b">Company</th>}
                        <th className="p-4 border-b">Exp</th>
                        <th className="p-4 border-b">Education</th>
                       <th className="p-4 border-b">
                          Salary
                          <span className="block text-xs font-normal text-gray-400 normal-case">(self-reported)</span>
                        </th>
                        <th className="p-4 border-b">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {safeResults.map((row, idx) => {
                        const viewedInfo = getViewedStatus(row.id);
                        const isViewed = !!viewedInfo;
                        const isViewedByCurrentUser = viewedInfo?.is_current_user;
                        const totalViews = viewedInfo?.total_views || 0;
                        
                        return (
                          <React.Fragment key={idx}>
                            <tr className="hover:bg-[#FAF7FF] transition-colors">
                              <td className="p-4 font-semibold text-[#4B2E83]">
                                <div className="flex items-center gap-2">
                                  {row.name}
                                  {canSeeBDViews && isViewed && (
                                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                                      isViewedByCurrentUser 
                                        ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                                        : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                                    }`}>
                                      {isViewedByCurrentUser ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                      {isViewedByCurrentUser ? 'You viewed' : 'Viewed'}
                                      {totalViews > 0 && (
                                        <span className="flex items-center gap-1 ml-1">
                                          <Users className="w-3 h-3" />
                                          {totalViews}
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-4 text-gray-600">{!!row.age ? row.age : '-'}</td>
                              <td className="p-4 text-gray-600">{row.gender || '-'}</td>
                              <td className="p-4 text-gray-600">{row.current_location}</td>
                              <td className="p-4 text-gray-600">{row.designation || row.current_designation || '-'}</td>
                              {isBusinessDev && <td className="p-4 text-gray-600">{row.company_name || '-'}</td>}
                              <td className="p-4 text-gray-600">{row.total_experience ? `${row.total_experience} Yrs` : '-'}</td>
                              <td className="p-4 text-gray-600">{row.last_education || row.qualification || '-'}</td>
                              <td className="p-4 text-gray-600">{row.salary_text || '-'}</td>
                              <td className="p-4">
                                <button 
                                  onClick={() => handleContactView(row)} 
                                  disabled={markingViewed[row.id]}
                                  className={`px-4 py-1.5 rounded-lg transition-colors text-xs font-medium flex items-center gap-2 ${markingViewed[row.id]
                                      ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                      : 'bg-[#4B2E83] text-white hover:bg-[#3a2366]'
                                  }`}
                                >
                                  {markingViewed[row.id] ? (
                                    <><Loader2 className="w-3 h-3 animate-spin" /> Loading...</>
                                  ) : (
                                    'View Contact'
                                  )}
                                </button>
                              </td>
                            </tr>
                            {canSeeBDViews && isViewed && (
                              <tr className="bg-gray-50">
                                <td colSpan={isBusinessDev ? "10" : "9"} className="p-3 px-4 text-sm text-gray-600 border-t border-gray-100">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">
                                        Viewed by: {viewedInfo.viewed_by_name || 'User'}
                                        {viewedInfo.viewer_department && ` (${viewedInfo.viewer_department})`}
                                      </span>
                                      {isViewedByCurrentUser && (
                                        <span className="text-blue-600 text-xs font-medium bg-blue-50 px-2 py-0.5 rounded">
                                          (You)
                                        </span>
                                      )}
                                      {isAdmin && !isBusinessDev && (
                                        <span className="text-red-600 text-xs font-medium bg-red-50 px-2 py-0.5 rounded">
                                          (Admin View)
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                      {totalViews > 0 && (
                                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                          Total views: {totalViews}
                                        </span>
                                      )}
                                      <div className="text-gray-500 text-xs">
                                        {formatDate(viewedInfo.viewed_at)}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 border-t">
                  <div className="text-sm text-gray-600">
                  Showing {safeResults.length} of {totalResults} results
              {nameSearch && nameSearch.trim() && (
  <span className="ml-2 text-purple-600 font-medium">(searching: "{nameSearch}")</span>
)}
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={prevPage} 
                      disabled={currentPage === 1} 
                      className={`flex items-center px-3 py-1 rounded-md text-sm font-medium transition-colors ${currentPage === 1 || isLoading ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                    </button>
                    <span className="flex items-center px-3 py-1 bg-[#4B2E83] text-white rounded-md text-sm font-bold">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button 
                      onClick={nextPage} 
                      disabled={currentPage === totalPages} 
                      className={`flex items-center px-3 py-1 rounded-md text-sm font-medium transition-colors ${currentPage === totalPages || isLoading ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                    >
                      Next <ChevronRight className="w-4 h-4 ml-1" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      {selectedProfile && <ContactPopup profile={selectedProfile} onClose={() => setSelectedProfile(null)} />}
    </div>
  );
};

export default AdvancedFilterPage;