import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  CircleAlert,
  ExternalLink,
  GraduationCap,
  GripVertical,
  Info,
  Library,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { catalogCourseById, catalogCourses, cloneCourse, createSeedPlanner, officialSources } from './catalog';
import { evaluatePlan } from './degreeRules';
import type { BreadthArea, CourseKind, CourseTemplate, PlannedCourse, Planner, Term } from './types';

const STORAGE_KEY = 'degree-canvas-tamu-mscs-v1';
const dragType = 'application/x-degree-canvas-course';

type DragPayload =
  | { kind: 'catalog'; courseId: string }
  | { kind: 'planned'; sourceTermId: string; instanceId: string };

type CustomDraft = {
  code: string;
  title: string;
  credits: number;
  kind: CourseKind;
};

const kindLabels: Record<CourseKind, string> = {
  'csce-graded': 'Graded CSCE',
  seminar: 'Seminar',
  research: 'Research',
  'directed-study': 'Directed study',
  'non-csce-grad': 'Non-CSCE grad',
  'csce-400': 'CSCE 400-level',
  other: 'Custom item',
};

const emptyCustomDraft = (): CustomDraft => ({
  code: '',
  title: '',
  credits: 3,
  kind: 'other',
});

const creditLabel = (credits: number) => `${credits} credit${credits === 1 ? '' : 's'}`;

const sumCredits = (courses: PlannedCourse[]) =>
  courses.reduce((total, course) => total + course.credits, 0);

function isPlanner(candidate: unknown): candidate is Planner {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const value = candidate as Partial<Planner>;

  return Array.isArray(value.terms) && Boolean(value.completedBreadth);
}

function loadPlanner(): Planner {
  if (typeof window === 'undefined') {
    return createSeedPlanner();
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as unknown;
      if (isPlanner(parsed)) {
        return parsed;
      }
    }
  } catch {
  }

  return createSeedPlanner();
}

function statusCopy(status: 'complete' | 'pending' | 'warning') {
  if (status === 'complete') {
    return 'On track';
  }

  return status === 'warning' ? 'Review' : 'Remaining';
}

function breadthFromRequirementId(id: string): BreadthArea | undefined {
  if (!id.startsWith('breadth-')) {
    return undefined;
  }

  const area = id.replace('breadth-', '');
  return area === 'theory' || area === 'systems' || area === 'software' ? area : undefined;
}

function CourseTags({ course }: { course: Pick<PlannedCourse, 'kind' | 'breadth' | 'source'> }) {
  return (
    <div className="course-tags">
      <span className={`tag tag--${course.kind}`}>{kindLabels[course.kind]}</span>
      {course.breadth && <span className="tag tag--breadth">{course.breadth} breadth</span>}
      {course.source === 'custom' && <span className="tag tag--custom">Editable</span>}
    </div>
  );
}

type PlannedCourseCardProps = {
  course: PlannedCourse;
  term: Term;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onRemove: () => void;
  onUpdate: (patch: Partial<PlannedCourse>) => void;
};

function PlannedCourseCard({ course, term, onDragStart, onRemove, onUpdate }: PlannedCourseCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const minCredits = course.minCredits ?? 0;
  const maxCredits = course.maxCredits ?? 99;

  return (
    <article
      className={`planned-course ${isEditing ? 'planned-course--editing' : ''}`}
      draggable={!isEditing}
      onDragStart={onDragStart}
    >
      <div className="planned-course__topline">
        <span className="drag-handle" aria-label={`Drag ${course.code}`} title="Drag to another term">
          <GripVertical size={15} strokeWidth={2.2} />
        </span>
        <span className="course-code">{course.code || 'Untitled course'}</span>
        <button
          className="icon-button icon-button--quiet"
          type="button"
          aria-label={`Edit ${course.code}`}
          onClick={() => setIsEditing((editing) => !editing)}
        >
          <Pencil size={14} />
        </button>
        <button className="icon-button icon-button--quiet" type="button" aria-label={`Remove ${course.code}`} onClick={onRemove}>
          <X size={15} />
        </button>
      </div>
      {!isEditing ? (
        <>
          <p className="planned-course__title">{course.title}</p>
          <div className="planned-course__bottomline">
            <CourseTags course={course} />
            <label className="credit-control">
              <span className="sr-only">Credits for {course.code}</span>
              <input
                type="number"
                min={minCredits}
                max={maxCredits}
                value={course.credits}
                onChange={(event) => {
                  const nextCredits = Number(event.currentTarget.value);
                  if (Number.isFinite(nextCredits)) {
                    onUpdate({ credits: Math.max(minCredits, Math.min(maxCredits, nextCredits)) });
                  }
                }}
              />
              <span>cr</span>
            </label>
          </div>
          {(course.prerequisiteText || course.description) && (
            <details className="course-details">
              <summary>Catalog notes</summary>
              {course.description && <p>{course.description}</p>}
              {course.prerequisiteText && <p><strong>Prerequisite:</strong> {course.prerequisiteText}</p>}
              {term.id === 'fall-2026' && course.onlineFall2026 && (
                <p className="course-details__fit">Listed by TAMU Engineering Online for Fall 2026.</p>
              )}
            </details>
          )}
        </>
      ) : (
        <div className="course-editor">
          <p className="course-editor__notice">Changing course metadata makes this an editable planning entry; the catalog source remains available in the course bank.</p>
          <label>
            Course code
            <input value={course.code} onChange={(event) => onUpdate({ code: event.currentTarget.value, source: 'custom' })} />
          </label>
          <label>
            Title
            <input value={course.title} onChange={(event) => onUpdate({ title: event.currentTarget.value, source: 'custom' })} />
          </label>
          <div className="course-editor__grid">
            <label>
              Credits
              <input
                type="number"
                min="0"
                max="30"
                value={course.credits}
                onChange={(event) => onUpdate({ credits: Math.max(0, Number(event.currentTarget.value) || 0) })}
              />
            </label>
            <label>
              Classification
              <select value={course.kind} onChange={(event) => onUpdate({ kind: event.currentTarget.value as CourseKind, source: 'custom' })}>
                {Object.entries(kindLabels).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}
              </select>
            </label>
          </div>
          <button className="text-button" type="button" onClick={() => setIsEditing(false)}>Done editing</button>
        </div>
      )}
    </article>
  );
}

type TermColumnProps = {
  term: Term;
  index: number;
  canRemove: boolean;
  canMoveLater: boolean;
  onNameChange: (name: string) => void;
  onMoveTerm: (direction: -1 | 1) => void;
  onRemoveTerm: () => void;
  onDropCourse: (event: DragEvent<HTMLElement>) => void;
  onCourseDragStart: (course: PlannedCourse, event: DragEvent<HTMLElement>) => void;
  onRemoveCourse: (course: PlannedCourse) => void;
  onUpdateCourse: (course: PlannedCourse, patch: Partial<PlannedCourse>) => void;
};

function TermColumn({
  term,
  index,
  canRemove,
  canMoveLater,
  onNameChange,
  onMoveTerm,
  onRemoveTerm,
  onDropCourse,
  onCourseDragStart,
  onRemoveCourse,
  onUpdateCourse,
}: TermColumnProps) {
  const [dropDepth, setDropDepth] = useState(0);
  const credits = sumCredits(term.courses);

  return (
    <section
      className={`term-column ${dropDepth > 0 ? 'term-column--dropping' : ''}`}
      onDragEnter={(event) => {
        event.preventDefault();
        setDropDepth((depth) => depth + 1);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = event.dataTransfer.effectAllowed === 'move' ? 'move' : 'copy';
      }}
      onDragLeave={() => setDropDepth((depth) => Math.max(0, depth - 1))}
      onDrop={(event) => {
        setDropDepth(0);
        onDropCourse(event);
      }}
    >
      <header className="term-column__header">
        <div>
          <span className="term-column__eyebrow">Term {index + 1}</span>
          <input className="term-column__name" aria-label={`Name for term ${index + 1}`} value={term.name} onChange={(event) => onNameChange(event.currentTarget.value)} />
        </div>
        <div className="term-column__actions">
          <button className="icon-button" type="button" aria-label={`Move ${term.name} earlier`} onClick={() => onMoveTerm(-1)} disabled={index === 0}>
            <ArrowUp size={15} />
          </button>
          <button className="icon-button" type="button" aria-label={`Move ${term.name} later`} onClick={() => onMoveTerm(1)} disabled={!canMoveLater}>
            <ArrowDown size={15} />
          </button>
          <button className="icon-button" type="button" aria-label={`Remove ${term.name}`} onClick={onRemoveTerm} disabled={!canRemove}>
            <Trash2 size={15} />
          </button>
        </div>
      </header>
      <div className="term-column__meta"><span>{creditLabel(credits)}</span><span>{term.courses.length} items</span></div>
      <div className="term-column__courses">
        {term.courses.map((course) => (
          <PlannedCourseCard
            key={course.instanceId}
            course={course}
            term={term}
            onDragStart={(event) => onCourseDragStart(course, event)}
            onRemove={() => onRemoveCourse(course)}
            onUpdate={(patch) => onUpdateCourse(course, patch)}
          />
        ))}
        {term.courses.length === 0 && <div className="empty-dropzone">Drop an available course here</div>}
      </div>
      <p className="term-column__hint">Drag a course here or use the quick-add menu.</p>
    </section>
  );
}

export default function App() {
  const [planner, setPlanner] = useState<Planner>(loadPlanner);
  const [query, setQuery] = useState('');
  const [quickTermId, setQuickTermId] = useState(planner.terms[0]?.id ?? '');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customDraft, setCustomDraft] = useState<CustomDraft>(emptyCustomDraft);

  const evaluation = useMemo(() => evaluatePlan(planner), [planner]);
  const visibleCatalog = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return catalogCourses;
    }

    return catalogCourses.filter((course) =>
      [course.code, course.title, course.description, course.breadth, kindLabels[course.kind]]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [query]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(planner));
    } catch {
    }
  }, [planner]);

  useEffect(() => {
    if (!planner.terms.some((term) => term.id === quickTermId)) {
      setQuickTermId(planner.terms[0]?.id ?? '');
    }
  }, [planner.terms, quickTermId]);

  const addCatalogCourse = (courseId: string, destinationTermId = quickTermId) => {
    const template = catalogCourseById(courseId);
    if (!template || !destinationTermId) {
      return;
    }

    setPlanner((current) => ({
      ...current,
      terms: current.terms.map((term) =>
        term.id === destinationTermId
          ? { ...term, courses: [...term.courses, cloneCourse(template)] }
          : term,
      ),
    }));
  };

  const addCustomCourse = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!quickTermId || !customDraft.title.trim()) {
      return;
    }

    const template: CourseTemplate = {
      id: `custom-${Date.now().toString(36)}`,
      code: customDraft.code.trim() || 'Custom course',
      title: customDraft.title.trim(),
      defaultCredits: customDraft.credits,
      kind: customDraft.kind,
      source: 'custom',
    };

    setPlanner((current) => ({
      ...current,
      terms: current.terms.map((term) =>
        term.id === quickTermId
          ? { ...term, courses: [...term.courses, cloneCourse(template, customDraft.credits)] }
          : term,
      ),
    }));
    setCustomDraft(emptyCustomDraft());
    setShowCustomForm(false);
  };

  const moveCourse = (sourceTermId: string, destinationTermId: string, instanceId: string) => {
    if (sourceTermId === destinationTermId) {
      return;
    }

    setPlanner((current) => {
      const sourceTerm = current.terms.find((term) => term.id === sourceTermId);
      const movingCourse = sourceTerm?.courses.find((course) => course.instanceId === instanceId);
      if (!movingCourse) {
        return current;
      }

      return {
        ...current,
        terms: current.terms.map((term) => {
          if (term.id === sourceTermId) {
            return { ...term, courses: term.courses.filter((course) => course.instanceId !== instanceId) };
          }
          if (term.id === destinationTermId) {
            return { ...term, courses: [...term.courses, movingCourse] };
          }
          return term;
        }),
      };
    });
  };

  const handleDrop = (destinationTermId: string, event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const rawPayload = event.dataTransfer.getData(dragType);
    if (!rawPayload) {
      return;
    }

    try {
      const payload = JSON.parse(rawPayload) as DragPayload;
      if (payload.kind === 'catalog') {
        addCatalogCourse(payload.courseId, destinationTermId);
      }
      if (payload.kind === 'planned') {
        moveCourse(payload.sourceTermId, destinationTermId, payload.instanceId);
      }
    } catch {
    }
  };

  const updateCourse = (termId: string, instanceId: string, patch: Partial<PlannedCourse>) => {
    setPlanner((current) => ({
      ...current,
      terms: current.terms.map((term) =>
        term.id !== termId
          ? term
          : {
              ...term,
              courses: term.courses.map((course) =>
                course.instanceId === instanceId ? { ...course, ...patch } : course,
              ),
            },
      ),
    }));
  };

  const removeCourse = (termId: string, instanceId: string) => {
    setPlanner((current) => ({
      ...current,
      terms: current.terms.map((term) =>
        term.id === termId ? { ...term, courses: term.courses.filter((course) => course.instanceId !== instanceId) } : term,
      ),
    }));
  };

  const moveTerm = (termId: string, direction: -1 | 1) => {
    setPlanner((current) => {
      const index = current.terms.findIndex((term) => term.id === termId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.terms.length) {
        return current;
      }

      const terms = [...current.terms];
      [terms[index], terms[nextIndex]] = [terms[nextIndex], terms[index]];
      return { ...current, terms };
    });
  };

  const addTerm = () => {
    const id = `term-${Date.now().toString(36)}`;
    setPlanner((current) => ({
      ...current,
      terms: [
        ...current.terms,
        { id, name: `New term ${current.terms.length + 1}`, courses: [] },
      ],
    }));
    setQuickTermId(id);
  };

  const resetPlanner = () => {
    if (window.confirm('Reset every term and course to the original six-term planning starter?')) {
      setPlanner(createSeedPlanner());
    }
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Degree Canvas home">
          <span className="brand__mark"><GraduationCap size={24} strokeWidth={2.25} /></span>
          <span>
            <strong>Degree Canvas</strong>
            <small>TAMU MSCS thesis planner</small>
          </span>
        </a>
        <div className="site-header__actions">
          <span className="saved-state"><span aria-hidden="true" />Saved on this device</span>
          <a className="header-link" href="#sources"><BookOpen size={15} />Sources</a>
          <button className="header-reset" type="button" onClick={resetPlanner}><RefreshCw size={15} />Reset</button>
        </div>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="planner-title">
          <div className="hero__copy">
            <p className="eyebrow">TEXAS A&amp;M UNIVERSITY · MASTER OF SCIENCE IN COMPUTER SCIENCE</p>
            <h1 id="planner-title">Make the degree plan<br />feel <em>knowable.</em></h1>
            <p className="hero__lede">A hands-on thesis-degree workspace: place catalog courses, tune each term, and see the official MSCS policy implications immediately.</p>
          </div>
          <aside className="hero__note">
            <Info size={18} />
            <div>
              <strong>Start with assumptions, not surprises.</strong>
              <p>Systems breadth begins marked complete as requested. It is editable and adds no plan credits.</p>
            </div>
          </aside>
        </section>

        <section className="metric-strip" aria-label="Plan summary">
          <div className="metric-card"><span>Planned credits</span><strong>{evaluation.totalCredits}</strong><small>30 minimum</small></div>
          <div className="metric-card"><span>Graded CSCE</span><strong>{evaluation.gradedCsceCredits}</strong><small>18 minimum</small></div>
          <div className={`metric-card ${evaluation.researchCredits > 6 ? 'metric-card--attention' : ''}`}><span>CSCE 691 reserve</span><strong>{evaluation.researchCredits}</strong><small>3–6 allowed total</small></div>
          <div className="metric-card"><span>Terms on board</span><strong>{planner.terms.length}</strong><small>fully editable</small></div>
        </section>

        <div className="planner-layout">
          <aside className="requirements-panel" aria-label="Degree requirements">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Live validation</p>
                <h2>Degree requirements</h2>
              </div>
              <span className="panel-heading__count">{evaluation.requirements.filter((requirement) => requirement.status === 'complete').length}/{evaluation.requirements.length}</span>
            </div>
            <p className="panel-intro">Rules below come from the MSCS degree page. Course placement and prior-completion switches remain yours to edit.</p>
            <div className="requirement-list">
              {evaluation.requirements.map((requirement) => {
                const area = breadthFromRequirementId(requirement.id);
                return (
                  <article key={requirement.id} className={`requirement requirement--${requirement.status}`}>
                    <div className="requirement__icon">
                      {requirement.status === 'complete' ? <Check size={16} /> : <CircleAlert size={16} />}
                    </div>
                    <div className="requirement__content">
                      <div className="requirement__label-row"><strong>{requirement.label}</strong><span>{statusCopy(requirement.status)}</span></div>
                      <p className="requirement__value">{requirement.value}</p>
                      <p className="requirement__explanation">{requirement.explanation}</p>
                      {area && (
                        <label className="prior-completion-toggle">
                          <input
                            type="checkbox"
                            checked={planner.completedBreadth[area]}
                            onChange={(event) => setPlanner((current) => ({
                              ...current,
                              completedBreadth: { ...current.completedBreadth, [area]: event.currentTarget.checked },
                            }))}
                          />
                          <span>Treat as complete before this plan</span>
                        </label>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="rule-legend">
              <span><i className="legend-dot legend-dot--official" />Official degree rule</span>
              <span><i className="legend-dot legend-dot--editable" />Editable assumption</span>
            </div>
          </aside>

          <section className="planner-workspace" aria-label="Planning board">
            <header className="workspace-header">
              <div>
                <p className="section-kicker">Your working plan</p>
                <h2>Planning board</h2>
                <p>Drag available courses into a term, or move a card between terms. Credits, names, order, and term count are all editable.</p>
              </div>
              <button className="primary-button" type="button" onClick={addTerm}><Plus size={17} />Add term</button>
            </header>

            <div className="term-board" aria-label="Term board">
              {planner.terms.map((term, index) => (
                <TermColumn
                  key={term.id}
                  term={term}
                  index={index}
                  canRemove={planner.terms.length > 1}
                  canMoveLater={index < planner.terms.length - 1}
                  onNameChange={(name) => setPlanner((current) => ({
                    ...current,
                    terms: current.terms.map((item) => item.id === term.id ? { ...item, name } : item),
                  }))}
                  onMoveTerm={(direction) => moveTerm(term.id, direction)}
                  onRemoveTerm={() => setPlanner((current) => ({
                    ...current,
                    terms: current.terms.filter((item) => item.id !== term.id),
                  }))}
                  onDropCourse={(event) => handleDrop(term.id, event)}
                  onCourseDragStart={(course, event) => {
                    const payload: DragPayload = { kind: 'planned', sourceTermId: term.id, instanceId: course.instanceId };
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData(dragType, JSON.stringify(payload));
                  }}
                  onRemoveCourse={(course) => removeCourse(term.id, course.instanceId)}
                  onUpdateCourse={(course, patch) => updateCourse(term.id, course.instanceId, patch)}
                />
              ))}
              <button className="new-term-tile" type="button" onClick={addTerm}><Plus size={19} />Add a term</button>
            </div>

            <div className="board-footnote">
              <Info size={16} />
              <p><strong>Term fit is intentionally conservative:</strong> a Fall 2026 badge means TAMU Engineering Online listed the course for that exact term. No badge is not an availability prediction; verify future offerings in Howdy.</p>
            </div>
          </section>
        </div>

        <section className="course-library" aria-labelledby="course-library-heading">
          <header className="library-header">
            <div>
              <p className="section-kicker">Catalog-backed course bank</p>
              <h2 id="course-library-heading">Courses to place</h2>
              <p>Titles, credits, and prerequisite text come from the TAMU CSCE graduate catalog. Drag cards to the board, or use quick add.</p>
            </div>
            <div className="library-header__controls">
              <label className="search-control">
                <Search size={16} />
                <span className="sr-only">Search course bank</span>
                <input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search code, topic, or breadth" />
              </label>
              <label className="term-select">
                <span>Quick add to</span>
                <select value={quickTermId} onChange={(event) => setQuickTermId(event.currentTarget.value)}>
                  {planner.terms.map((term) => <option key={term.id} value={term.id}>{term.name || 'Untitled term'}</option>)}
                </select>
              </label>
            </div>
          </header>
          <div className="catalog-grid">
            {visibleCatalog.map((course) => (
              <article
                key={course.id}
                className="catalog-course"
                draggable
                onDragStart={(event) => {
                  const payload: DragPayload = { kind: 'catalog', courseId: course.id };
                  event.dataTransfer.effectAllowed = 'copy';
                  event.dataTransfer.setData(dragType, JSON.stringify(payload));
                }}
              >
                <div className="catalog-course__topline"><span className="drag-handle" title="Drag to a term"><GripVertical size={16} /></span><span className="course-code">{course.code}</span><span className="catalog-course__credits">{creditLabel(course.defaultCredits)}</span></div>
                <h3>{course.title}</h3>
                <CourseTags course={course} />
                {course.description && <p>{course.description}</p>}
                {course.prerequisiteText && <p className="catalog-course__prerequisite"><strong>Catalog:</strong> {course.prerequisiteText}</p>}
                {course.onlineFall2026 && <span className="availability-badge">Fall 2026 online listing</span>}
                <button className="outline-button catalog-course__add" type="button" onClick={() => addCatalogCourse(course.id)}><Plus size={15} />Add to plan</button>
              </article>
            ))}
          </div>
          {visibleCatalog.length === 0 && <div className="catalog-empty">No catalog course matches “{query}”. Try a course number, a subject, or a breadth area.</div>}

          <div className="custom-course-wrap">
            <div>
              <p className="section-kicker">Your own item</p>
              <h3>Add a custom planning course</h3>
              <p>Use this for an advisor-approved option, non-CSCE graduate course, or a placeholder. Its classification is editable for validation purposes.</p>
            </div>
            <button className="outline-button" type="button" onClick={() => setShowCustomForm((visible) => !visible)}><Plus size={15} />{showCustomForm ? 'Close form' : 'Add custom course'}</button>
          </div>
          {showCustomForm && (
            <form className="custom-course-form" onSubmit={addCustomCourse}>
              <label>Course code<input value={customDraft.code} onChange={(event) => setCustomDraft((current) => ({ ...current, code: event.currentTarget.value }))} placeholder="Example: STAT 640" /></label>
              <label>Course title<input required value={customDraft.title} onChange={(event) => setCustomDraft((current) => ({ ...current, title: event.currentTarget.value }))} placeholder="Advisor-approved elective" /></label>
              <label>Credits<input type="number" min="0" max="30" value={customDraft.credits} onChange={(event) => setCustomDraft((current) => ({ ...current, credits: Math.max(0, Number(event.currentTarget.value) || 0) }))} /></label>
              <label>Classification<select value={customDraft.kind} onChange={(event) => setCustomDraft((current) => ({ ...current, kind: event.currentTarget.value as CourseKind }))}>{Object.entries(kindLabels).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></label>
              <button className="primary-button" type="submit"><Plus size={16} />Add to {planner.terms.find((term) => term.id === quickTermId)?.name || 'plan'}</button>
            </form>
          )}
        </section>

        <section className="guidance" aria-labelledby="guidance-heading">
          <header className="guidance__header">
            <div>
              <p className="section-kicker">Explain the checks</p>
              <h2 id="guidance-heading">Live planning notes</h2>
            </div>
            <span>{evaluation.alerts.length} active</span>
          </header>
          <div className="guidance__grid">
            {evaluation.alerts.map((alert) => (
              <article key={alert.id} className={`guidance-card guidance-card--${alert.level}`}>
                {alert.level === 'warning' ? <CircleAlert size={18} /> : <Info size={18} />}
                <div><h3>{alert.title}</h3><p>{alert.detail}</p></div>
              </article>
            ))}
            {evaluation.alerts.length === 0 && <div className="guidance-card guidance-card--clear"><Check size={18} /><div><h3>No policy or preparation alerts</h3><p>Continue to verify the final degree plan with the advisory committee and graduate advisor.</p></div></div>}
          </div>
        </section>

        <section className="sources" id="sources" aria-labelledby="sources-heading">
          <div>
            <p className="section-kicker">Source boundary</p>
            <h2 id="sources-heading">Official TAMU sources only</h2>
            <p>This planner separates published requirements from editable assumptions. It does not replace degree-plan approval, the advisory committee, or the current Howdy schedule.</p>
          </div>
          <div className="source-links">
            {officialSources.map((source) => <a key={source.href} href={source.href} target="_blank" rel="noreferrer"><Library size={16} />{source.label}<ExternalLink size={13} /></a>)}
          </div>
        </section>
      </main>

      <footer className="site-footer">Degree Canvas · local-first planning workspace · TAMU MSCS thesis degree</footer>
    </div>
  );
}
