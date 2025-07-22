// import TextField from './text';
// import MultiSelectField from './multiSelect';
// import SelectField from './select';
// import DateField from './date';
// import DateRangeField from './dateRange';
// import FileUploadField from './fileUpload';
// import NumberField from './number';
// import ListField from './list';
// import CheckBox from './checkbox';
// import RadioButton from './radioButton';
// import EmailField from './email';
// import TimeField from './time';
// import CheckBoxField from './checkboxField';
// import RadioField from './radioField';
// import HealthInfo from './healthInfo';
// import RoomsField from './room';
// import RoomField from './room/room';
// import EquipmentField from './equipment';
// import PhoneNumberField from './phoneNumber';
// import YearField from './year';
// import URLField from './url';
// import RichTextField from './richTextField';
// import RadioButtonNDIS from './radioButtonNdis';
// import RadioFieldNDIS from './radioFieldNdis';
// import GoalTable from './goalTable';
// import CareTable from './careTable';

// export const fields = {
//     "text": TextField,
//     "string": TextField,
//     "multi-select": MultiSelectField,
//     "select": SelectField,
//     "date": DateField,
//     "date-range": DateRangeField,
//     "year": YearField,
//     "file-upload": FileUploadField,
//     "time": TimeField,
//     "integer": NumberField,
//     // "info": ListField,
//     "email": EmailField,
//     "checkbox": CheckBoxField,
//     "radio": RadioField,
//     "health-info": HealthInfo,
//     "room": RoomField,
//     "rooms": RoomsField,
//     "equipment": EquipmentField,
//     "phone-number": PhoneNumberField,
//     "url": URLField,
//     "rich-text": RichTextField,

//     // below field types are used internally. These are not part of the draggable fields.
//     "simple-radio": RadioButton,
//     "simple-checkbox": CheckBox,

//     "radio-ndis": RadioFieldNDIS,
//     "simple-radio-ndis": RadioButtonNDIS,

//     "goal-table": GoalTable,
//     "care-table": CareTable,
// }

// export const GetField = (props) => {
//     return fields[props.type](props);
// }   