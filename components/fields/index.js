import InputField from './input';
import SelectField from './select';
import DateField from './date';
import DateRangeField from './dateRange';
import FileUploadField from './fileUpload';
import CheckBox from './checkbox';
import RadioButton from './radioButton';
import TimeField from './time';
import CheckBoxField from './checkboxField';
import RadioField from './radioField';
import HealthInfo from './healthInfo';
import RoomsField from './room';
import EquipmentField from './equipment';
import YearField from './year';
import URLField from './url';
import RichTextField from './richTextField';
import RadioButtonNDIS from './radioButtonNdis';
import RadioFieldNDIS from './radioFieldNdis';
import GoalTable from './goalTable';
import CareTable from './careTable';
import CardField from './cardField';
import PackageSelection from './packageSelection';
import ServiceCardsField from './serviceCards';
import { forwardRef } from 'react';

export const fields = {
    "text": (props) => <InputField {...props} type="text" />,
    "string": (props) => <InputField {...props} type="text" />,
    "email": (props) => <InputField {...props} type="email" />,
    "phone-number": (props) => <InputField {...props} type="phone-number" />,
    "integer": (props) => <InputField {...props} type="integer" />,
    "multi-select": (props) => <SelectField {...props} multi={true} />,
    "select": (props) => <SelectField {...props} multi={false} />,
    "date": DateField,
    "date-range": (props) => <DateRangeField {...props} />,
    "year": YearField,
    "checkbox": CheckBoxField,
    "checkbox-button": (props) => <CheckBoxField {...props} mode="button" />,
    "radio": RadioField,
    "file-upload": FileUploadField,
    "time": TimeField,
    "url": URLField,
    "rich-text": RichTextField,
    "rooms": RoomsField,
    "equipment": forwardRef((props, ref) => <EquipmentField ref={ref} {...props} />),
    "health-info": HealthInfo,
    
    // Horizontal Card Selection Components
    "card-selection": (props) => <CardField {...props} multi={false} />,
    "card-selection-multi": (props) => <CardField {...props} multi={true} />,
    "horizontal-card": (props) => <CardField {...props} multi={false} />,
    "horizontal-card-multi": (props) => <CardField {...props} multi={true} />,

    // Package Selection Components
    "package-selection": (props) => <PackageSelection {...props} multi={false} />,
    "package-selection-multi": (props) => <PackageSelection {...props} multi={true} />,

    // below field types are used internally. These are not part of the draggable fields.
    "simple-radio": RadioButton,
    "simple-checkbox": CheckBox,

    "radio-ndis": RadioFieldNDIS,
    "simple-radio-ndis": RadioButtonNDIS,

    "goal-table": GoalTable,
    "care-table": CareTable,

    "service-cards": (props) => <ServiceCardsField {...props} />,
    "service-cards-multi": (props) => <ServiceCardsField {...props} multi={true} />,
}

export const GetField = forwardRef((props, ref) => {
    const FieldComponent = fields[props.type];
    if (!FieldComponent) {
        console.warn(`Unknown field type: ${props.type}`);
        return null;
    }
    
    // For equipment field, pass the ref
    if (props.type === 'equipment') {
        return <FieldComponent ref={ref} {...props} />;
    }
    
    return <FieldComponent {...props} />;
});

GetField.displayName = 'GetField';