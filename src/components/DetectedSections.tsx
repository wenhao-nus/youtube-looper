import { Loader2, Sparkles } from 'lucide-react';
import { formatTime } from '../utils/time';
import type { DetectedSongSection, SectionDetectionStatus } from '../lib/songSections';

type DetectedSectionsProps = {
  status: SectionDetectionStatus;
  sections: DetectedSongSection[];
  selectedSectionId: string | null;
  message: string | null;
  disabled: boolean;
  onDetect: () => void;
  onSelectSection: (section: DetectedSongSection) => void;
};

export function DetectedSections({
  status,
  sections,
  selectedSectionId,
  message,
  disabled,
  onDetect,
  onSelectSection,
}: DetectedSectionsProps) {
  const isLoading = status === 'loading';
  const hasSections = sections.length > 0;

  return (
    <section className="panel detected-sections" aria-labelledby="detected-sections-title">
      <div className="section-header">
        <div>
          <h2 id="detected-sections-title">Song sections</h2>
          <p>{getStatusText(status, sections.length)}</p>
        </div>
        <button type="button" onClick={onDetect} disabled={disabled || isLoading}>
          {isLoading ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
          Detect
        </button>
      </div>

      {message ? (
        <p className={status === 'error' ? 'field-message error' : 'field-message warning'}>
          {message}
        </p>
      ) : null}

      {hasSections ? (
        <div className="sections-list" aria-label="Detected song sections">
          {sections.map((section) => (
            <button
              type="button"
              className={section.id === selectedSectionId ? 'section-row active' : 'section-row'}
              key={section.id}
              onClick={() => onSelectSection(section)}
              disabled={disabled}
              aria-label={`Loop ${section.label} from ${formatTime(section.start)} to ${formatTime(
                section.end,
              )}`}
            >
              <div>
                <strong>{section.label}</strong>
                <span>{getConfidenceLabel(section.confidence)}</span>
              </div>
              <time>
                {formatTime(section.start)} - {formatTime(section.end)}
              </time>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function getStatusText(status: SectionDetectionStatus, sectionCount: number): string {
  if (status === 'loading') {
    return 'This might take some time.';
  }

  if (sectionCount > 0) {
    return `${sectionCount} sections detected.`;
  }

  return 'Generate timestamps from the video.';
}

function getConfidenceLabel(confidence: DetectedSongSection['confidence']): string {
  if (confidence === 'high') {
    return 'High confidence';
  }

  if (confidence === 'medium') {
    return 'Medium confidence';
  }

  return 'Low confidence';
}
