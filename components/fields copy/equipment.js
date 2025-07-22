import { useEffect, useState } from "react";
import _, { set } from "lodash";
import { omitAttribute } from "../../utilities/common";
import RadioField from "./equipmentRadioField";
import CheckBoxField from "./equipmentCheckboxField";
import { useRouter } from "next/router";
import Image from "next/image";
import { useDebouncedCallback } from 'use-debounce';
import { useSelector } from "react-redux";
import CheckBox from "./checkbox";
import { BOOKING_TYPES } from "../constants";

const EquipmentField = (props) => {
    const bookingType = useSelector(state => state.bookingRequestForm.bookingType);
    const [equipmentChanges, setEquipmentChanges] = useState([]);
    const [equipmentTypes, setEquipmentTypes] = useState([
        // 'mattress_options',
        // 'bed_rails',
        // 'ceiling_hoist',
        // 'sling',
        // 'shower_commodes',
        // 'adaptive_bathroom_options',
        // 'slide_transfer_boards',
        // 'wheelchair_chargers',
        // 'remote_room_openers',
        // 'bed_controllers',
    ]);
    const [equipments, setEquipments] = useState([]);
    const [currentBookingEquipments, setCurrentBookingEquipments] = useState([]);
    const [mattressOptions, setMattressOptions] = useState([]);
    const [bedRails, setBedRails] = useState([]);
    const [ceilingHoist, setCeilingHoist] = useState([]);
    const [sling, setSling] = useState([]);
    const [confirmShowerCommodes, setConfirmShowerCommodes] = useState([{ label: 'Yes', value: false }, { label: 'No', value: false }]);
    const [showerCommodes, setShowerCommodes] = useState([]);
    const [confirmAdaptiveBathroomOptions, setConfirmAdaptiveBathroomOptions] = useState([{ label: 'Yes', value: false }, { label: 'No', value: false }]);
    const [adaptiveBathroomOptions, setAdaptiveBathroomOptions] = useState([]);
    const [slideTransferBoards, setSlideTransferBoards] = useState([]);
    const [wheelchairChargers, setWheelchairChargers] = useState([]);
    const [remoteRoomOpeners, setRemoteRoomOpeners] = useState([]);
    const [bedControllers, setBedControllers] = useState([]);
    const [transferAids, setTransferAids] = useState([]);
    const [miscellaneous, setMiscellaneous] = useState([]);

    const [showSlingOptions, setShowSlingOptions] = useState(false);

    const [isHighBackTiltComode, setIsHighBackTiltComode] = useState(false);
    const [confirmNeedTiltCommodeOverToilet, setConfirmNeedTiltCommodeOverToilet] = useState([{ label: 'Yes', value: false }, { label: 'No', value: false }]);

    const [ackowledgeChanges, setAcknowledgeChanges] = useState(false);

    const router = useRouter();
    const { uuid, prevBookingId } = router.query;

    useEffect(() => {
        if (uuid) {  // Only fetch if uuid exists
            fetchCurrentBookingEquipments(uuid);
            fetchEquipments();
        }
    }, [uuid]);

    useEffect(() => {
        if (props.equipmentChanges) {
            setEquipmentChanges(props.equipmentChanges);
        }
    }, [props.equipmentChanges]);

    useEffect(() => {
        if (currentBookingEquipments) {
            setMattressOptions(equipments.filter((equipment) => equipment.EquipmentCategory.name == 'mattress_options'  && !equipment.hidden)
                .map((equipment, index) => { return { ...equipment, label: equipment.name, value: currentBookingEquipments.some(ce => ce.name == equipment.name) } }))

            setBedRails(equipments.filter((equipment) => equipment.EquipmentCategory.name == 'bed_rails'  && !equipment.hidden)
                .map(equipment => { return { ...equipment, label: equipment.name, value: currentBookingEquipments.some(ce => ce.name == equipment.name) } }));

            if (currentBookingEquipments.some(ce => ce.EquipmentCategory && ce.EquipmentCategory.name == 'ceiling_hoist')
                && currentBookingEquipments.some(ce => ce.EquipmentCategory && ce.EquipmentCategory.name == 'sling')) {
                setCeilingHoist([{ label: 'No', value: false }, { label: 'Yes', value: true }])
            } else {
                setCeilingHoist([{ label: 'No', value: true }, { label: 'Yes', value: false }])
            }

            setSling(equipments.filter((equipment) => equipment.EquipmentCategory.name == 'sling'  && !equipment.hidden)
                .map(equipment => { return { ...equipment, label: equipment.name, value: currentBookingEquipments.some(ce => ce.name == equipment.name) } }));

            if (currentBookingEquipments.some(ce => ce.EquipmentCategory && ce.EquipmentCategory.name == 'sling')) {
                setShowSlingOptions(true);
            }

            if (currentBookingEquipments.length == 0 && 
                !currentBookingEquipments.some(ce => ce.EquipmentCategory && ce.EquipmentCategory.name == 'ceiling_hoist') &&
                !currentBookingEquipments.some(ce => ce.EquipmentCategory && ce.EquipmentCategory.name == 'sling')) {
                setCeilingHoist([{ label: 'No', value: false }, { label: 'Yes', value: false }])
            }

            setConfirmShowerCommodes(currentBookingEquipments.some(ce => ce.EquipmentCategory && ce.EquipmentCategory.name == 'shower_commodes') ?
                [{ label: 'Yes', value: true }, { label: 'No', value: false }] :
                [{ label: 'Yes', value: false }, { label: 'No', value: currentBookingEquipments.length > 0 }]);

            setShowerCommodes(equipments.filter((equipment) => equipment.EquipmentCategory.name == 'shower_commodes' && !equipment.hidden)
                .map(equipment => { return { ...equipment, label: equipment.name, value: currentBookingEquipments.some(ce => ce.name == equipment.name) } }));

            const showerComodes = currentBookingEquipments.filter(ce => ce.EquipmentCategory && ce.EquipmentCategory.name == 'shower_commodes');
            setConfirmNeedTiltCommodeOverToilet(currentBookingEquipments.some(ce => ce.EquipmentCategory && ce.EquipmentCategory.name == 'shower_commodes' && ce.hidden) ? 
                [{ label: 'Yes', value: true }, { label: 'No', value: false }] :
                [{ label: 'Yes', value: false }, { label: 'No', value: showerComodes.length > 0 }]);

            setIsHighBackTiltComode(showerComodes?.some(ce => ce.name == 'Commode: High Back Tilt'));

            setConfirmAdaptiveBathroomOptions(currentBookingEquipments.some(ce => ce.EquipmentCategory && ce.EquipmentCategory.name == 'adaptive_bathroom_options') ?
                [{ label: 'Yes', value: true }, { label: 'No', value: false }] :
                [{ label: 'Yes', value: false }, { label: 'No', value: currentBookingEquipments.length > 0 }]);

            setAdaptiveBathroomOptions(equipments.filter((equipment) => equipment.EquipmentCategory.name == 'adaptive_bathroom_options'  && !equipment.hidden)
                .map(equipment => { return { ...equipment, label: equipment.name, value: currentBookingEquipments.some(ce => ce.name == equipment.name) } }));

            setSlideTransferBoards(currentBookingEquipments.some(ce => ce.EquipmentCategory && ce.EquipmentCategory.name == 'slide_transfer_boards') ?
                [{ label: 'Yes', value: true }, { label: 'No', value: false }] :
                [{ label: 'Yes', value: false }, { label: 'No', value: currentBookingEquipments.length > 0 }]);

            setWheelchairChargers(currentBookingEquipments.some(ce => ce.EquipmentCategory && ce.EquipmentCategory.name == 'wheelchair_chargers') ?
                [{ label: 'Yes', value: true }, { label: 'No', value: false }] :
                [{ label: 'Yes', value: false }, { label: 'No', value: currentBookingEquipments.length > 0 }]);

            setRemoteRoomOpeners(currentBookingEquipments.some(ce => ce.EquipmentCategory && ce.EquipmentCategory.name == 'remote_room_openers') ?
                [{ label: 'Yes', value: true }, { label: 'No', value: false }] :
                [{ label: 'Yes', value: false }, { label: 'No', value: currentBookingEquipments.length > 0 }]);

            setBedControllers(currentBookingEquipments.some(ce => ce.EquipmentCategory && ce.EquipmentCategory.name == 'bed_controllers') ?
                [{ label: 'Yes', value: true }, { label: 'No', value: false }] :
                [{ label: 'Yes', value: false }, { label: 'No', value: currentBookingEquipments.length > 0 }]);

            setTransferAids(equipments.filter((equipment) => equipment.EquipmentCategory.name == 'transfer_aids'  && !equipment.hidden)
                .map(equipment => { return { ...equipment, label: equipment.name, value: currentBookingEquipments.some(ce => ce.name == equipment.name) } }));

            setMiscellaneous(equipments.filter((equipment) => equipment.EquipmentCategory.name == 'miscellaneous'  && !equipment.hidden)
                .map(equipment => { return { ...equipment, label: equipment.name, value: currentBookingEquipments.some(ce => ce.name == equipment.name) } }));

            if (bookingType != BOOKING_TYPES.FIRST_TIME_GUEST) {
                setAcknowledgeChanges(currentBookingEquipments.some(ce => ce.type == 'acknowledgement' && ce.hidden));
            }
        }
    }, [equipments, currentBookingEquipments]);

    useEffect(() => {
        const confirmComodes = (confirmShowerCommodes.some(option => option.label == 'Yes' && option.value == true) ?
            showerCommodes.some(option => option.value == true) : true);
        const allQuestionsAnswered = mattressOptions.some(option => option.value == true) &&
            // bedRails.some(option => option.value == true == true) &&
            ceilingHoist.some(option => option.value == true) &&
            (showSlingOptions ? sling.some(option => option.value == true) : true) &&
            slideTransferBoards.some(option => option.value == true) &&
            wheelchairChargers.some(option => option.value == true) &&
            remoteRoomOpeners.some(option => option.value == true) &&
            (confirmAdaptiveBathroomOptions.some(option => option.label == 'Yes' && option.value == true) ? 
                adaptiveBathroomOptions.some(option => option.value == true) : true) && 
            bedControllers.some(option => option.value == true) &&
            confirmComodes &&
            ((confirmComodes && isHighBackTiltComode) ? 
                confirmNeedTiltCommodeOverToilet.some(option => option.value) : true) &&
            (bookingType == BOOKING_TYPES.FIRST_TIME_GUEST ? true : ackowledgeChanges);

        // console.log('ceilingHoist', ceilingHoist.some(option => option.value == true))
        // console.log('showSlingOptions', showSlingOptions, 'sling', sling.some(option => option.value == true))
        // console.log('bedControllers', bedControllers.some(option => option.value == true))
        // console.log('slideTransferBoards', slideTransferBoards.some(option => option.value == true))
        // console.log('wheelchairChargers', wheelchairChargers.some(option => option.value == true))
        // console.log('bedControllers', bedControllers.some(option => option.value == true))
        // console.log('confirmAdaptiveBathroomOptions', confirmAdaptiveBathroomOptions.some(option => option.label == 'Yes' && option.value == true), 'adaptiveBathroomOptions', adaptiveBathroomOptions.some(option => option.value == true))
        // console.log('confirmShowerCommodes', confirmShowerCommodes.some(option => option.label == 'Yes' && option.value == true), 'showerCommodes', showerCommodes.some(option => option.value == true))
        // console.log(((confirmComodes && isHighBackTiltComode) ? confirmNeedTiltCommodeOverToilet.some(option => option.value) : true))

        // console.log('allQuestionsAnswered', allQuestionsAnswered);
        if (props.hasOwnProperty('onChange')) {
            allQuestionsAnswered ? props.onChange(true, equipmentChanges) : props.onChange(false);
        }
    }, [equipmentChanges, mattressOptions, ceilingHoist, sling, confirmShowerCommodes, showerCommodes, slideTransferBoards, wheelchairChargers, remoteRoomOpeners, bedControllers, confirmAdaptiveBathroomOptions, adaptiveBathroomOptions, isHighBackTiltComode]);

    const fetchEquipments = async () => {
        try {
            const res = await fetch("/api/equipments?" + new URLSearchParams({ includeHidden: true }));
            if (!res.ok) throw new Error('Failed to fetch equipments');
            const data = await res.json();
            setEquipments(data);
            setEquipmentTypes(_.unionBy(data.map((equipment) => 
                omitAttribute(equipment, 'id', 'name', 'image_filename', 'createdAt', 'updatedAt')), 
                'EquipmentCategory.name'
            ));
        } catch (error) {
            console.error('Error fetching equipments:', error);
        }
    };
    
    const fetchCurrentBookingEquipments = async (bookingId) => {
        try {
            const res = await fetch(`/api/bookings/${bookingId}/equipments`);
            if (!res.ok) throw new Error('Failed to fetch booking equipments');
            const data = await res.json();
            setCurrentBookingEquipments(data);
        } catch (error) {
            console.error('Error fetching current booking equipments:', error);
        }
    };

    const handleEquipmentChange = (equipmentCategory, updatedOptions, hidden = false) => {
        let updatedEquipmentCategory = equipmentCategory;
        let change = null;

        const previousSelectedEquipments = currentBookingEquipments.filter(equipment => equipment?.EquipmentCategory?.name === equipmentCategory && equipment?.hidden == hidden);
    
        if (props.hasOwnProperty('onChange')) {
            let selectedEquipments = [];

            switch (equipmentCategory) {
                case 'mattress_options':
                    setMattressOptions(updatedOptions);
                    selectedEquipments = updatedOptions.filter(option => option.value === true);
                    change = {
                        category: equipmentCategory,
                        equipments: selectedEquipments,
                        isDirty: true
                    };
                    break;
    
                case 'bed_rails':
                    setBedRails(updatedOptions);
                    updatedOptions = updatedOptions.map(option => ({ ...option, type: 'group' }));
                    selectedEquipments = updatedOptions.filter(option => option.value === true);
                    let prevBedRailsEq = previousSelectedEquipments.length > 0 ? previousSelectedEquipments : null;
                    if (prevBedRailsEq) {
                        prevBedRailsEq = prevBedRailsEq.map(option => ({ ...option, value: false }));
                        selectedEquipments = _.uniqBy([...selectedEquipments, ...prevBedRailsEq], 'id');
                    }
                    change = {
                        category: equipmentCategory,
                        equipments: selectedEquipments,
                        isDirty: true
                    };
                    break;
                case 'transfer_aids':
                    setTransferAids(updatedOptions);
                    updatedOptions = updatedOptions.map(option => ({ ...option, type: 'group' }));
                    selectedEquipments = updatedOptions.filter(option => option.value === true);
                    let prevTransferAidsEq = previousSelectedEquipments.length > 0 ? previousSelectedEquipments : null;
                    if (prevTransferAidsEq) {
                        prevTransferAidsEq = prevTransferAidsEq.map(option => ({ ...option, value: false }));
                        selectedEquipments = _.uniqBy([...selectedEquipments, ...prevTransferAidsEq], 'id');
                    }
                    change = {
                        category: equipmentCategory,
                        equipments: selectedEquipments,
                        isDirty: true
                    };
                    break;
                case 'ceiling_hoist':
                    setCeilingHoist(updatedOptions);
                    const selectedOption = updatedOptions.find(o => o.value === true);
    
                    if (selectedOption && selectedOption.label === 'No') {
                        let ceilingEq = [];
                        let prevCeilingEq = previousSelectedEquipments.length > 0 ? previousSelectedEquipments : null;
                        if (prevCeilingEq) {
                            prevCeilingEq = prevCeilingEq.map(option => ({ ...option, value: false }));
                            ceilingEq = _.uniqBy([...prevCeilingEq], 'id');
                        }
                        const selectedSlingOptions = sling.filter(option => option.value === true);
                        let updatedSlingOptions = [];
                        if (selectedSlingOptions.length > 0) {
                            updatedSlingOptions = selectedSlingOptions.map(option => ({ ...option, value: false }));
                        }
                        setSling(sling.map(option => ({ ...option, value: false })));
                        setShowSlingOptions(false);
                        change = [
                            {
                                category: equipmentCategory,
                                equipments: ceilingEq,
                                isDirty: true
                            },
                            {
                                category: 'sling',
                                equipments: updatedSlingOptions,
                                isDirty: true
                            }
                        ];
                    } else if (selectedOption && selectedOption.label === 'Yes') {
                        const ceilingHoistEq = equipments.find(equipment =>
                            equipment.EquipmentCategory.name === 'ceiling_hoist'
                        );
    
                        selectedEquipments = [{ ...ceilingHoistEq, value: selectedOption.label === 'Yes' }];
                        setShowSlingOptions(true);
                        change = {
                            category: equipmentCategory,
                            equipments: selectedEquipments,
                            isDirty: true
                        };
                    }
                    break;
    
                case 'sling':
                    setSling(updatedOptions);
                    selectedEquipments = updatedOptions.filter(option => option.value === true);
                    change = {
                        category: equipmentCategory,
                        equipments: selectedEquipments,
                        isDirty: true
                    };
                    break;
    
                case 'confirm_shower_commodes':
                    updatedEquipmentCategory = 'shower_commodes';
                    setConfirmShowerCommodes(updatedOptions);
                    if (updatedOptions.some(option => option.label === 'No' && option.value)) {
                        const showerEq = showerCommodes.filter(equipment => equipment.value == true);
                        const updatedShowerCommodes = showerEq ? showerEq.map(option => ({ ...option, value: false })) : [];
                        setShowerCommodes(showerCommodes.map(option => ({ ...option, value: false })));
                        change = {
                            category: updatedEquipmentCategory,
                            equipments: updatedShowerCommodes,
                            isDirty: true
                        };
                    }
                    break;
    
                case 'shower_commodes':
                    setShowerCommodes(updatedOptions);
                    selectedEquipments = updatedOptions.filter(option => option.value === true);

                    const highBackTilt = selectedEquipments.length > 0 && selectedEquipments.some(option => option.name === 'Commode: High Back Tilt');
                    setIsHighBackTiltComode(highBackTilt);

                    let confirmTiltEq = equipments.find(equipment => equipment.EquipmentCategory.name === 'shower_commodes' && equipment.hidden);
                    if (!highBackTilt) {
                        confirmTiltEq.value = false;
                        selectedEquipments.push(confirmTiltEq);
                    }

                    change = {
                        category: equipmentCategory,
                        equipments: selectedEquipments,
                        isDirty: true
                    };
                    break;

                case 'confirm_need_tilt_over_toilet':
                    updatedEquipmentCategory = 'shower_commodes';
                    setConfirmNeedTiltCommodeOverToilet(updatedOptions);

                    let confirmTiltEquipment = equipments.find(equipment => equipment.EquipmentCategory.name === 'shower_commodes' && equipment.hidden);
                    confirmTiltEquipment = { ...confirmTiltEquipment, value: updatedOptions.some(option => option.label == 'Yes' && option.value) ? true : false }
                    if (confirmNeedTiltCommodeOverToilet != updatedOptions) {
                        change = {
                            category: updatedEquipmentCategory,
                            equipments: [confirmTiltEquipment],
                            isDirty: true
                        };
                    }

                    break;
                case 'confirm_adaptive_bathroom_options':
                    updatedEquipmentCategory = 'adaptive_bathroom_options';
                    setConfirmAdaptiveBathroomOptions(updatedOptions);
                    if (updatedOptions.some(option => option.label === 'No' && option.value)) {
                        const adaptiveEq = adaptiveBathroomOptions.filter(equipment => equipment.value == true);
                        const updatedAdaptiveBathroomOptions = adaptiveEq ? adaptiveEq.map(option => ({ ...option, value: false })) : [];
                        setAdaptiveBathroomOptions(adaptiveBathroomOptions.map(option => ({ ...option, value: false })));
                        if (currentBookingEquipments.some(ce => ce.EquipmentCategory.name === 'adaptive_bathroom_options')) {
                            change = {
                                category: updatedEquipmentCategory,
                                equipments: updatedAdaptiveBathroomOptions,
                                isDirty: true
                            };
                        }
                    }
                    break;

                case 'adaptive_bathroom_options':
                    updatedOptions = updatedOptions.map(option => ({ ...option, type: 'group' }));
                    setAdaptiveBathroomOptions(updatedOptions);
                    selectedEquipments = updatedOptions.filter(option => option.value === true);
                    change = {
                        category: equipmentCategory,
                        equipments: selectedEquipments,
                        isDirty: true
                    };
                    break;
    
                case 'slide_transfer_boards':
                    setSlideTransferBoards(updatedOptions);
                    const slideEq = equipments.find(equipment => 
                        equipment.EquipmentCategory.name === 'slide_transfer_boards'
                    );
                    selectedEquipments = [{ ...slideEq, value: updatedOptions.find(option => option.label === 'Yes').value}];
                    change = {
                        category: equipmentCategory,
                        equipments: selectedEquipments,
                        isDirty: true
                    };
                    
                    break;
    
                case 'wheelchair_chargers':
                    setWheelchairChargers(updatedOptions);
                        const wheelchairEq = equipments.find(equipment => 
                            equipment.EquipmentCategory.name === 'wheelchair_chargers'
                        );
                        selectedEquipments = [{ ...wheelchairEq, value: updatedOptions.find(option => option.label === 'Yes').value}];
                        change = {
                            category: equipmentCategory,
                            equipments: selectedEquipments,
                            isDirty: true
                        };
                    
                    break;
    
                case 'remote_room_openers':
                    setRemoteRoomOpeners(updatedOptions);
                    const remoteEq = equipments.find(equipment => 
                        equipment.EquipmentCategory.name === 'remote_room_openers'
                    );
                    selectedEquipments = [{ ...remoteEq, value: updatedOptions.find(option => option.label === 'Yes').value}];
                    change = {
                        category: equipmentCategory,
                        equipments: selectedEquipments,
                        isDirty: true
                    };
                    break;
    
                case 'bed_controllers':
                    setBedControllers(updatedOptions);
                    const bedEq = equipments.find(equipment => 
                        equipment.EquipmentCategory.name === 'bed_controllers'
                    );
                    selectedEquipments = [{ ...bedEq, value: updatedOptions.find(option => option.label === 'Yes').value}];
                    change = {
                        category: equipmentCategory,
                        equipments: selectedEquipments,
                        isDirty: true
                    };
                    break;
                case 'acknowledgement':
                    setAcknowledgeChanges(updatedOptions);
                    const acknowledgementEq = equipments.find(equipment => equipment.type == 'acknowledgement' && equipment.hidden);
                    selectedEquipments = [{ ...acknowledgementEq, value: updatedOptions}];
                    change = {
                        category: 'acknowledgement',
                        equipments: selectedEquipments,
                        isDirty: true
                    };
                    break;
            }
    
            if (change) {
                if (Array.isArray(change)) {
                    const filteredChanges = equipmentChanges.filter(c => !change.some(ch => {
                        if (ch.category !== c.category) return false;
                        
                        const changeHasHiddenEquipment = ch.equipments.some(e => e.hidden);
                        const existingHasHiddenEquipment = c.equipments.some(e => e.hidden);
                        
                        return changeHasHiddenEquipment === existingHasHiddenEquipment;
                    }));
                    const newChanges = [...filteredChanges, ...change].filter(c => c.equipments.length > 0);
                    setEquipmentChanges(newChanges);
                } else {
                    const filteredChanges = equipmentChanges.filter(c => {
                        if (c.category !== change.category) return true;
                        
                        const changeHasHiddenEquipment = change.equipments.some(e => e.hidden);
                        const existingHasHiddenEquipment = c.equipments.some(e => e.hidden);
                        
                        return changeHasHiddenEquipment !== existingHasHiddenEquipment;
                    });
                    const newChanges = [...filteredChanges, change].filter(c => c.equipments.length > 0);

                    setEquipmentChanges(newChanges);
                }
            }
        }
    };

    const syncEquipment = useDebouncedCallback(async (category, equipments, isDirty) => {
        const response = await fetch(`/api/bookings/${uuid}/update-equipments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ category, equipments, isDirty })
        });
    }, 1000);

    return (
        uuid ? <div className={`mb-2 overflow-hidden ${props.className || ''}`}>
            {props.label && <label className="font-semibold form-label inline-block mb-1.5 text-slate-700">{props.label}</label>}
            <div className="py-4">
                <RadioField
                    options={mattressOptions}
                    label={'Mattress Options'}
                    required={true}
                    disabled={props?.disabled}
                    onChange={(label, updatedOptions) => { handleEquipmentChange('mattress_options', updatedOptions) }} />
            </div>
            <div className="py-4">
                {/* SF-330: Bed rail question change */}
                <CheckBoxField
                    options={bedRails}
                    label={'Bed Rails'}
                    required={false}
                    disabled={props?.disabled}
                    onChange={(label, updatedOptions) => handleEquipmentChange('bed_rails', updatedOptions)} />
            </div>
            <div className="py-4">
                <CheckBoxField
                    options={transferAids}
                    label={'Transfer Aids'}
                    required={false}
                    disabled={props?.disabled}
                    onChange={(label, updatedOptions) => handleEquipmentChange('transfer_aids', updatedOptions)} />
            </div>
            <div className="py-4">
                <RadioField disabled={props?.disabled} options={ceilingHoist} label={'Will you be using our ceiling hoist?'} required={true}
                    onChange={(label, updatedOptions) => handleEquipmentChange('ceiling_hoist', updatedOptions)} />
            </div>
            {showSlingOptions && (
                <div>
                    <RadioField options={sling}
                        disabled={props?.disabled}
                        label={'Sling'}
                        required={showSlingOptions}
                        onChange={(label, updatedOptions) => handleEquipmentChange('sling', updatedOptions)} />
                </div>
            )}
            <div className="py-4">
                <RadioField disabled={props?.disabled} options={confirmShowerCommodes} label={'Would you like to use one of our self-propelled or attendant-propelled Shower Commodes?'}
                    onChange={(label, updatedOptions) => handleEquipmentChange('confirm_shower_commodes', updatedOptions)} required={true} />
                {/* TODO - update this field to hide and display the other Shower Commodes question */}
            </div>
            {confirmShowerCommodes.find(option => option.label == 'Yes').value && <div className="py-4">
                <RadioField
                    disabled={props?.disabled}
                    options={showerCommodes}
                    label={'Types of Shower Commodes available'}
                    required={confirmShowerCommodes.find(option => option.label == 'Yes').value === true ? true : false}
                    onChange={(label, updatedOptions) => handleEquipmentChange('shower_commodes', updatedOptions)} />
            </div>}
            {isHighBackTiltComode && (
                <div className="py-4">
                    <RadioField disabled={props?.disabled} options={confirmNeedTiltCommodeOverToilet} label={'Do you need to tilt your commode over the toilet?'}
                        onChange={(label, updatedOptions) => handleEquipmentChange('confirm_need_tilt_over_toilet', updatedOptions, true)} required={true} />
                </div>
            )}
            <div className="py-4">
                <RadioField disabled={props?.disabled} options={confirmAdaptiveBathroomOptions} label={'Would you like to use any of our adaptive bathroom options?'} required={true}
                    onChange={(label, updatedOptions) => handleEquipmentChange('confirm_adaptive_bathroom_options', updatedOptions)} />
            </div>
            {confirmAdaptiveBathroomOptions.find(option => option.label == 'Yes').value && <div className="py-4">
                <CheckBoxField
                    disabled={props?.disabled}
                    options={adaptiveBathroomOptions}
                    label={'Types of our adaptive bathroom options available'}
                    required={confirmAdaptiveBathroomOptions.find(option => option.label == 'Yes') ? true : false}
                    onChange={(label, updatedOptions) => handleEquipmentChange('adaptive_bathroom_options', updatedOptions)} />
            </div>}
            <div className="py-4 grid grid-cols-12 gap-4">
                <div className="col-span-10">
                    <RadioField disabled={props?.disabled} options={slideTransferBoards} label={'Would you like to use a slide transfer board?'}
                        onChange={(label, updatedOptions) => handleEquipmentChange('slide_transfer_boards', updatedOptions)} required={true} />
                </div>
                <div className="col-span-2">
                    <BinaryEquipmentImage equipments={equipments} category='slide_transfer_boards' />
                </div>
            </div>
            <div className="py-4 grid grid-cols-12 gap-4">
                <div className="col-span-10">
                    <RadioField disabled={props?.disabled} options={wheelchairChargers} label={'Do you require a wheelchair charger for this stay?'}
                        onChange={(label, updatedOptions) => handleEquipmentChange('wheelchair_chargers', updatedOptions)} required={true} />
                </div>
                <div className="col-span-2">
                    <BinaryEquipmentImage equipments={equipments} category='wheelchair_chargers' />
                </div>
            </div>
            <div className="py-4 grid grid-cols-12 gap-4">
                <div className="col-span-10">
                    <RadioField disabled={props?.disabled} options={remoteRoomOpeners} className="col-span-10" label={'Do you need to be set up with a remote door opener (activated by a jelly bean switch) to access your room? (i.e. you do not have the hand/arm function to hold your door fob near the electronic opener).'}
                        onChange={(label, updatedOptions) => handleEquipmentChange('remote_room_openers', updatedOptions)} required={true} />
                </div>
                <div className="col-span-2">
                    <BinaryEquipmentImage equipments={equipments} category='remote_room_openers' />
                </div>
            </div>
            <div className="py-4 grid grid-cols-12 gap-4">
                <div className="col-span-10">
                    <RadioField disabled={props?.disabled} options={bedControllers} label={'Do you need to be set up with an accessible bed controller (shown here, activated by a jelly bean switch) to operate your adjustable bed? (i.e. you do not have the hand/arm function to press the buttons on a standard adjustable bed remote control)'}
                        onChange={(label, updatedOptions) => handleEquipmentChange('bed_controllers', updatedOptions)} required={true} />
                </div>
                <div className="col-span-2">
                    <BinaryEquipmentImage equipments={equipments} category='remote_room_openers' />
                </div>
            </div>

            { bookingType !== BOOKING_TYPES.FIRST_TIME_GUEST && (<div className="py-4 flex">
                <span className="text-xs text-red-500 ml-1 font-bold">*</span>
                <CheckBox
                    bold={true}
                    label={'I verify all the information above is true and updated.'}
                    value={ackowledgeChanges}
                    checked={ackowledgeChanges}
                    required={true}
                    onChange={(label, value, notAvailableFlag) => { handleEquipmentChange('acknowledgement', value, true) }} />
            </div>)}

        </div> : <p>loading...</p>
    )
}

const BinaryEquipmentImage = ({ equipments, category }) => {
    let equipment = equipments.find(equipment => equipment.EquipmentCategory.name == category);
    const url = equipment?.image_url ? equipment.image_url : equipment?.image_filename ? `/equipments/${equipment.image_filename}` : '';
    return equipment && url && <Image className="min-w-min rounded-md ml-4" src={url} width={100} height={100} />
}

export default EquipmentField;