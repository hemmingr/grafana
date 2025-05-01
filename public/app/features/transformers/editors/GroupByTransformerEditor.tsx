import { css } from '@emotion/css';
import { useCallback } from 'react';

import {
  DataTransformerID,
  ReducerID,
  SelectableValue,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
  GrafanaTheme2,
} from '@grafana/data';
import { GroupByFieldOptions, GroupByOperationID, GroupByTransformerOptions } from '@grafana/data/internal';
import { useTheme2, Select, StatsPicker, InlineField, Stack, Alert, Checkbox } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { getTransformationContent } from '../docs/getTransformationContent';
import { useAllFieldNamesFromDataFrames } from '../utils';

interface FieldProps {
  fieldName: string;
  config?: GroupByFieldOptions;
  onConfigChange: (config: GroupByFieldOptions) => void;
}

// If a calculation is done with only one reducer that will not aggregate the value with others, we want
const nonMutatingReducers = [
  ReducerID.first,
  ReducerID.firstNotNull,
  ReducerID.last,
  ReducerID.lastNotNull,
  ReducerID.min,
  ReducerID.logmin,
  ReducerID.max,
];

export const GroupByTransformerEditor = ({
  input,
  options,
  onChange,
}: TransformerUIProps<GroupByTransformerOptions>) => {
  const fieldNames = useAllFieldNamesFromDataFrames(input, true);

  const onConfigChange = useCallback(
    (fieldName: string) => (config: GroupByFieldOptions) => {
      onChange({
        ...options,
        fields: {
          ...options.fields,
          [fieldName]: config,
        },
      });
    },
    // Adding options to the dependency array causes infinite loop here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChange]
  );

  // See if there's both an aggregation and grouping field configured
  // for calculations. If not we display a warning because there
  // needs to be a grouping for the calculation to have effect
  let hasGrouping,
    hasAggregation = false;

  for (const field of Object.values(options.fields)) {
    if (field.aggregations.length > 0 && field.operation !== null) {
      hasAggregation = true;
    }
    if (field.operation === GroupByOperationID.groupBy) {
      hasGrouping = true;
    }
  }

  const showCalcAlert = hasAggregation && !hasGrouping;

  return (
    <Stack direction="column">
      {showCalcAlert && (
        <Alert
          title={t(
            'transformers.group-by-transformer-editor.title-calc-alert',
            'Calculations will not have an effect if no fields are being grouped on'
          )}
          severity="warning"
        />
      )}
      {fieldNames.map((key) => (
        <GroupByFieldConfiguration
          onConfigChange={onConfigChange(key)}
          fieldName={key}
          config={options.fields[key]}
          key={key}
        />
      ))}
    </Stack>
  );
};

const options = [
  { label: 'Group by', value: GroupByOperationID.groupBy },
  { label: 'Calculate', value: GroupByOperationID.aggregate },
];

export const GroupByFieldConfiguration = ({ fieldName, config, onConfigChange }: FieldProps) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  const onChange = useCallback(
    (value: SelectableValue<GroupByOperationID | null>) => {
      onConfigChange({
        aggregations: config?.aggregations ?? [],
        operation: value?.value ?? null,
        keepContentsOfRow: config?.keepContentsOfRow ?? false,
      });
    },
    [config, onConfigChange]
  );

  return (
    <InlineField className={styles.label} label={fieldName} grow shrink>
      <Stack gap={0.5} direction="row">
        <div className={styles.operation}>
          <Select
            options={options}
            value={config?.operation}
            placeholder={t('transformers.group-by-field-configuration.placeholder-ignored', 'Ignored')}
            onChange={onChange}
            isClearable
          />
        </div>

        {config?.operation === GroupByOperationID.aggregate && (
          <>
            <StatsPicker
              className={styles.aggregations}
              placeholder={t('transformers.group-by-field-configuration.placeholder-select-stats', 'Select stats')}
              allowMultiple
              stats={config.aggregations}
              onChange={(stats) => {
                onConfigChange({ ...config, aggregations: stats as ReducerID[] });
              }}
            />
            {config.aggregations.length === 1 && nonMutatingReducers.includes(config.aggregations[0]) && (
              <Checkbox
                value={config.keepContentsOfRow ?? false}
                label={t(
                  'transformers.group-by-field-configuration.label-include-contents-of-row',
                  'Include contents of row'
                )}
                onChange={(e) => {
                  onConfigChange({ ...config, keepContentsOfRow: e.currentTarget.checked });
                }}
              />
            )}
          </>
        )}
      </Stack>
    </InlineField>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    label: css({
      label: {
        minWidth: theme.spacing(32),
      },
    }),
    operation: css({
      flexShrink: 0,
      height: '100%',
      width: theme.spacing(24),
    }),
    aggregations: css({
      flexGrow: 1,
    }),
  };
};

export const groupByTransformRegistryItem: TransformerRegistryItem<GroupByTransformerOptions> = {
  id: DataTransformerID.groupBy,
  editor: GroupByTransformerEditor,
  transformation: standardTransformers.groupByTransformer,
  name: standardTransformers.groupByTransformer.name,
  description: standardTransformers.groupByTransformer.description,
  categories: new Set([
    TransformerCategory.Combine,
    TransformerCategory.CalculateNewFields,
    TransformerCategory.Reformat,
  ]),
  help: getTransformationContent(DataTransformerID.groupBy).helperDocs,
};
