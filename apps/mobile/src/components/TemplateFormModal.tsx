import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Alert,
} from "react-native";
import type { ChatTemplateItem, TemplateField } from "@chatbot/shared-types";
import { lookupUserByPhone } from "../api/client";

interface TemplateFormModalProps {
  visible: boolean;
  template: ChatTemplateItem | null;
  onClose: () => void;
  onSubmit: (formData: Record<string, string>) => Promise<void>;
  defaultUserName?: string;
  defaultUserPhone?: string;
  tenantId?: string;
}

// Common time slots for sports facilities
const MORNING_SLOTS = ["06:00 AM", "07:00 AM", "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM"];
const AFTERNOON_SLOTS = ["12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM"];
const EVENING_SLOTS = ["05:00 PM", "06:00 PM", "07:00 PM", "08:00 PM", "09:00 PM"];

const DAYS_OF_WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function TemplateFormModal({
  visible,
  template,
  onClose,
  onSubmit,
  defaultUserName = "",
  defaultUserPhone = "",
  tenantId,
}: TemplateFormModalProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Phone auto-population status
  const [isLookingUpPhone, setIsLookingUpPhone] = useState(false);
  const [autoPopulatedName, setAutoPopulatedName] = useState<string | null>(null);
  const lastLookedUpPhone = useRef<string>("");

  // Sub-pickers state
  const [activeDropdownField, setActiveDropdownField] = useState<TemplateField | null>(null);
  const [activeDateField, setActiveDateField] = useState<TemplateField | null>(null);
  const [activeTimeField, setActiveTimeField] = useState<TemplateField | null>(null);

  // Calendar state
  const [calDate, setCalDate] = useState<Date>(new Date());

  // Duration controls state
  const [durationHours, setDurationHours] = useState(1);
  const [durationMinutes, setDurationMinutes] = useState("00");

  // Initialize or reset form state whenever template changes or modal opens
  useEffect(() => {
    if (visible && template) {
      const initial: Record<string, string> = {};
      const fields = template.fields || [];

      let initialPhone = defaultUserPhone;
      let initialName = defaultUserName;

      for (const field of fields) {
        const keyLower = (field.key || field.label).toLowerCase();

        if (field.defaultValue) {
          initial[field.label] = field.defaultValue;
        } else if (
          (keyLower.includes("phone") || keyLower.includes("contact") || keyLower.includes("mobile")) &&
          initialPhone
        ) {
          initial[field.label] = initialPhone;
        } else if (
          (keyLower.includes("name") || keyLower.includes("member") || keyLower.includes("athlete")) &&
          initialName
        ) {
          initial[field.label] = initialName;
        } else if (keyLower === "duration") {
          initial[field.label] = "1 Hr 00 Min";
        } else if (keyLower === "players" || keyLower.includes("player")) {
          initial[field.label] = "2";
        } else {
          initial[field.label] = "";
        }
      }

      setFormData(initial);
      setErrors({});
      setAutoPopulatedName(null);
      setDurationHours(1);
      setDurationMinutes("00");
      lastLookedUpPhone.current = "";

      // If initial phone exists, trigger lookup
      if (initialPhone && initialPhone.replace(/\D/g, "").length >= 10) {
        triggerPhoneLookup(initialPhone, fields);
      }
    }
  }, [visible, template, defaultUserName, defaultUserPhone]);

  // Debounced auto-lookup on phone number change
  const triggerPhoneLookup = useCallback(
    async (rawPhone: string, fields: TemplateField[]) => {
      const digits = rawPhone.replace(/\D/g, "");
      if (digits.length < 10) return;
      if (lastLookedUpPhone.current === digits) return;

      lastLookedUpPhone.current = digits;
      setIsLookingUpPhone(true);

      try {
        const profile = await lookupUserByPhone(digits, tenantId);
        if (profile.found && profile.name) {
          setAutoPopulatedName(profile.name);
          setFormData((prev) => {
            const next = { ...prev };
            // Populate name field
            for (const f of fields) {
              const k = (f.key || f.label).toLowerCase();
              if ((k.includes("name") || k.includes("member") || k.includes("athlete")) && !next[f.label]) {
                next[f.label] = profile.name!;
              } else if (k.includes("email") && profile.email && !next[f.label]) {
                next[f.label] = profile.email;
              }
              // If previous profile had preferred sport/court
              if (profile.metadata && profile.metadata[f.key] && !next[f.label]) {
                next[f.label] = String(profile.metadata[f.key]);
              }
            }
            return next;
          });
        } else {
          setAutoPopulatedName(null);
        }
      } catch (err) {
        console.warn("[triggerPhoneLookup] error:", err);
      } finally {
        setIsLookingUpPhone(false);
      }
    },
    [tenantId]
  );

  if (!template) return null;

  const handleChangeField = (label: string, value: string, field?: TemplateField) => {
    setFormData((prev) => ({ ...prev, [label]: value }));
    if (errors[label]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[label];
        return next;
      });
    }

    // If typing in phone field, trigger lookup once 10+ digits entered
    const isPhone =
      field?.type === "phone" ||
      field?.key?.toLowerCase().includes("phone") ||
      label.toLowerCase().includes("phone");

    if (isPhone) {
      const digits = value.replace(/\D/g, "");
      if (digits.length >= 10) {
        triggerPhoneLookup(value, template.fields || []);
      } else {
        setAutoPopulatedName(null);
      }
    }
  };

  // Duration stepper & circular minute handler
  const updateDuration = (hours: number, mins: string, durationFieldLabel?: string) => {
    setDurationHours(hours);
    setDurationMinutes(mins);
    const formatted = `${hours} Hr ${mins} Min`;

    const label = durationFieldLabel ||
      (template.fields || []).find((f) => (f.key || f.label).toLowerCase().includes("duration"))?.label;

    if (label) {
      setFormData((prev) => ({ ...prev, [label]: formatted }));
    }
  };

  const handleHourStep = (delta: number, fieldLabel: string) => {
    const nextHours = Math.max(1, Math.min(8, durationHours + delta));
    updateDuration(nextHours, durationMinutes, fieldLabel);
  };

  const handleMinuteSelect = (mins: string, fieldLabel: string) => {
    updateDuration(durationHours, mins, fieldLabel);
  };

  // Form submission
  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};
    const fields = template.fields || [];

    for (const field of fields) {
      if (field.required) {
        const val = formData[field.label]?.trim();
        if (!val) {
          newErrors[field.label] = `${field.label} is required`;
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      Alert.alert("Incomplete Form", "Please fill in all mandatory fields marked with *");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (err: any) {
      Alert.alert("Submission Error", err.message || "Failed to submit form");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calendar Helpers
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays: Array<number | null> = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(d);
  }

  const handleSelectDay = (day: number) => {
    if (!activeDateField) return;
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
    handleChangeField(activeDateField.label, dateStr, activeDateField);
    setActiveDateField(null);
  };

  const handleSelectQuickDate = (type: "today" | "tomorrow" | "weekend") => {
    if (!activeDateField) return;
    const now = new Date();
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

    let target = new Date();
    if (type === "tomorrow") {
      target.setDate(now.getDate() + 1);
    } else if (type === "weekend") {
      const daysUntilSat = (6 - now.getDay() + 7) % 7 || 7;
      target.setDate(now.getDate() + daysUntilSat);
    }

    const dateStr = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
    handleChangeField(activeDateField.label, dateStr, activeDateField);
    setActiveDateField(null);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.sheetContainer}
            >
              {/* Sheet Drag Pill & Header */}
              <View style={styles.header}>
                <View style={styles.dragPill} />
                <View style={styles.titleRow}>
                  <View style={styles.titleInfo}>
                    <View style={styles.iconCircle}>
                      <Text style={styles.iconText}>{template.icon || "📋"}</Text>
                    </View>
                    <View style={styles.titleTextGroup}>
                      <Text style={styles.title}>{template.name}</Text>
                      <View style={styles.sheetTabBadge}>
                        <Text style={styles.sheetTabText}>
                          📊 Google Sheet Tab: {template.sheetName}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={onClose}
                    style={styles.closeBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.closeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Auto-populated profile status banner */}
                {autoPopulatedName && (
                  <View style={styles.autoPopulatedBanner}>
                    <Text style={styles.autoPopulatedIcon}>✨</Text>
                    <Text style={styles.autoPopulatedText}>
                      Loaded profile for <Text style={styles.autoPopulatedBold}>{autoPopulatedName}</Text> from mobile records!
                    </Text>
                  </View>
                )}

                {template.description ? (
                  <Text style={styles.description}>{template.description}</Text>
                ) : null}
              </View>

              {/* Form Input Fields */}
              <ScrollView
                style={styles.formScroll}
                contentContainerStyle={styles.formScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {(template.fields || []).map((field: TemplateField, idx: number) => {
                  const hasError = !!errors[field.label];
                  const fieldKey = (field.key || field.label).toLowerCase();
                  const isPhoneField =
                    field.type === "phone" || fieldKey.includes("phone");
                  const isDurationField =
                    fieldKey === "duration" || field.label.toLowerCase().includes("duration");
                  const isDropdown =
                    field.type === "dropdown" ||
                    field.type === "choice" ||
                    (field.options && field.options.length > 0);
                  const isDateField = field.type === "date" || fieldKey.includes("date");
                  const isTimeField = field.type === "time" || fieldKey.includes("time");
                  const isTextarea = field.type === "textarea";
                  const isBooleanField = field.type === "boolean";
                  const isNumber =
                    field.type === "number" || field.type === "float" || fieldKey === "players";

                  const currentValue = formData[field.label] ?? "";

                  return (
                    <View key={field.key || idx} style={styles.fieldGroup}>
                      <View style={styles.labelRow}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={styles.label}>
                            {field.label}
                            {field.required && <Text style={styles.requiredStar}> *</Text>}
                          </Text>
                          {isPhoneField && isLookingUpPhone && (
                            <ActivityIndicator size="small" color="#00A884" />
                          )}
                        </View>
                        {field.required ? (
                          <Text style={styles.reqBadge}>Required</Text>
                        ) : (
                          <Text style={styles.optBadge}>Optional</Text>
                        )}
                      </View>

                      {/* 1. SPECIALIZED DURATION CONTROL (Hour Stepper + Circular Dial Minutes) */}
                      {isDurationField ? (
                        <View style={styles.durationCard}>
                          <View style={styles.durationHeaderRow}>
                            <Text style={styles.durationValueText}>
                              ⏱️ {currentValue || `${durationHours} Hr ${durationMinutes} Min`}
                            </Text>
                            <Text style={styles.durationSubText}>Standard Slot</Text>
                          </View>

                          <View style={styles.durationControlsRow}>
                            {/* Hour Stepper */}
                            <View style={styles.hourStepperContainer}>
                              <Text style={styles.stepperLabel}>HOURS (+/- 1 Hr)</Text>
                              <View style={styles.stepperPill}>
                                <TouchableOpacity
                                  style={styles.stepperBtn}
                                  onPress={() => handleHourStep(-1, field.label)}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  <Text style={styles.stepperBtnText}>-</Text>
                                </TouchableOpacity>
                                <Text style={styles.stepperCurrentValue}>{durationHours} Hr</Text>
                                <TouchableOpacity
                                  style={styles.stepperBtn}
                                  onPress={() => handleHourStep(1, field.label)}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  <Text style={styles.stepperBtnText}>+</Text>
                                </TouchableOpacity>
                              </View>
                            </View>

                            {/* Circular Minute Dial */}
                            <View style={styles.circularDialWrapper}>
                              <Text style={styles.stepperLabel}>MINUTES (CIRCULAR DIAL)</Text>
                              <View style={styles.circularClockPlate}>
                                <View style={styles.clockCenterHub}>
                                  <Text style={styles.clockCenterText}>:{durationMinutes}</Text>
                                </View>

                                {/* 12 o'clock :00 */}
                                <TouchableOpacity
                                  style={[
                                    styles.radialBtn,
                                    styles.radialTop,
                                    durationMinutes === "00" && styles.radialActive,
                                  ]}
                                  onPress={() => handleMinuteSelect("00", field.label)}
                                >
                                  <Text
                                    style={[
                                      styles.radialText,
                                      durationMinutes === "00" && styles.radialTextActive,
                                    ]}
                                  >
                                    :00
                                  </Text>
                                </TouchableOpacity>

                                {/* 3 o'clock :15 */}
                                <TouchableOpacity
                                  style={[
                                    styles.radialBtn,
                                    styles.radialRight,
                                    durationMinutes === "15" && styles.radialActive,
                                  ]}
                                  onPress={() => handleMinuteSelect("15", field.label)}
                                >
                                  <Text
                                    style={[
                                      styles.radialText,
                                      durationMinutes === "15" && styles.radialTextActive,
                                    ]}
                                  >
                                    :15
                                  </Text>
                                </TouchableOpacity>

                                {/* 6 o'clock :30 */}
                                <TouchableOpacity
                                  style={[
                                    styles.radialBtn,
                                    styles.radialBottom,
                                    durationMinutes === "30" && styles.radialActive,
                                  ]}
                                  onPress={() => handleMinuteSelect("30", field.label)}
                                >
                                  <Text
                                    style={[
                                      styles.radialText,
                                      durationMinutes === "30" && styles.radialTextActive,
                                    ]}
                                  >
                                    :30
                                  </Text>
                                </TouchableOpacity>

                                {/* 9 o'clock :45 */}
                                <TouchableOpacity
                                  style={[
                                    styles.radialBtn,
                                    styles.radialLeft,
                                    durationMinutes === "45" && styles.radialActive,
                                  ]}
                                  onPress={() => handleMinuteSelect("45", field.label)}
                                >
                                  <Text
                                    style={[
                                      styles.radialText,
                                      durationMinutes === "45" && styles.radialTextActive,
                                    ]}
                                  >
                                    :45
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          </View>
                        </View>
                      ) : isDropdown ? (
                        /* 2. DROPDOWN / FACILITY PICKER (Court 1, Court 2, etc.) */
                        <TouchableOpacity
                          style={[
                            styles.pickerTrigger,
                            hasError && styles.inputError,
                            !!currentValue && styles.pickerTriggerSelected,
                          ]}
                          onPress={() => setActiveDropdownField(field)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.pickerTriggerLeft}>
                            <Text style={styles.pickerTriggerIcon}>🏟️</Text>
                            <Text
                              style={[
                                styles.pickerTriggerText,
                                !currentValue && styles.pickerTriggerPlaceholder,
                              ]}
                            >
                              {currentValue || field.placeholder || "Tap to select facility / court..."}
                            </Text>
                          </View>
                          <Text style={styles.pickerTriggerArrow}>▼</Text>
                        </TouchableOpacity>
                      ) : isDateField ? (
                        /* 3. CALENDAR PICKER TRIGGER */
                        <TouchableOpacity
                          style={[
                            styles.pickerTrigger,
                            hasError && styles.inputError,
                            !!currentValue && styles.pickerTriggerSelected,
                          ]}
                          onPress={() => {
                            setActiveDateField(field);
                            setCalDate(new Date());
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={styles.pickerTriggerLeft}>
                            <Text style={styles.pickerTriggerIcon}>📅</Text>
                            <Text
                              style={[
                                styles.pickerTriggerText,
                                !currentValue && styles.pickerTriggerPlaceholder,
                              ]}
                            >
                              {currentValue || field.placeholder || "Tap to open booking calendar..."}
                            </Text>
                          </View>
                          <Text style={styles.pickerTriggerAction}>Pick Date</Text>
                        </TouchableOpacity>
                      ) : isTimeField ? (
                        /* 4. TIME SLOT GRID TRIGGER */
                        <TouchableOpacity
                          style={[
                            styles.pickerTrigger,
                            hasError && styles.inputError,
                            !!currentValue && styles.pickerTriggerSelected,
                          ]}
                          onPress={() => setActiveTimeField(field)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.pickerTriggerLeft}>
                            <Text style={styles.pickerTriggerIcon}>⏰</Text>
                            <Text
                              style={[
                                styles.pickerTriggerText,
                                !currentValue && styles.pickerTriggerPlaceholder,
                              ]}
                            >
                              {currentValue || field.placeholder || "Tap to select time slot grid..."}
                            </Text>
                          </View>
                          <Text style={styles.pickerTriggerAction}>Select Slot</Text>
                        </TouchableOpacity>
                      ) : isBooleanField ? (
                        /* 5. BOOLEAN CHECKBOX */
                        <View style={styles.booleanRow}>
                          <TouchableOpacity
                            style={[
                              styles.boolBtn,
                              currentValue === "Yes" && styles.boolBtnActive,
                            ]}
                            onPress={() => handleChangeField(field.label, "Yes", field)}
                          >
                            <Text
                              style={[
                                styles.boolBtnText,
                                currentValue === "Yes" && styles.boolBtnTextActive,
                              ]}
                            >
                              ✓ Yes
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.boolBtn,
                              currentValue === "No" && styles.boolBtnActive,
                            ]}
                            onPress={() => handleChangeField(field.label, "No", field)}
                          >
                            <Text
                              style={[
                                styles.boolBtnText,
                                currentValue === "No" && styles.boolBtnTextActive,
                              ]}
                            >
                              ✕ No
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : isTextarea ? (
                        /* 6. TEXTAREA */
                        <TextInput
                          style={[styles.input, styles.textarea, hasError && styles.inputError]}
                          placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                          placeholderTextColor="#8696A0"
                          value={currentValue}
                          onChangeText={(val) => handleChangeField(field.label, val, field)}
                          multiline
                          numberOfLines={3}
                          textAlignVertical="top"
                        />
                      ) : (
                        /* 7. STANDARD INPUT (Phone, Text, Number, Float, Email) */
                        <View style={styles.inputWithIconWrapper}>
                          <TextInput
                            style={[styles.input, hasError && styles.inputError]}
                            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                            placeholderTextColor="#8696A0"
                            value={currentValue}
                            onChangeText={(val) => handleChangeField(field.label, val, field)}
                            keyboardType={
                              isPhoneField
                                ? "phone-pad"
                                : isNumber
                                ? "numeric"
                                : field.type === "email"
                                ? "email-address"
                                : "default"
                            }
                            autoCapitalize={
                              field.type === "email" ? "none" : "sentences"
                            }
                          />
                          {isPhoneField && (
                            <View style={styles.phoneKeyBadge}>
                              <Text style={styles.phoneKeyBadgeText}>KEY 🔑</Text>
                            </View>
                          )}
                        </View>
                      )}

                      {hasError && (
                        <Text style={styles.errorText}>{errors[field.label]}</Text>
                      )}
                    </View>
                  );
                })}

                {/* Dual-sync badge note */}
                <View style={styles.syncNoteCard}>
                  <Text style={styles.syncNoteIcon}>🔒</Text>
                  <Text style={styles.syncNoteText}>
                    Form responses are automatically saved in PostgreSQL and synced to Google Sheets tab &ldquo;{template.sheetName}&rdquo; in real time.
                  </Text>
                </View>
              </ScrollView>

              {/* Footer Actions */}
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onClose}
                  disabled={isSubmitting}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                  activeOpacity={0.8}
                >
                  {isSubmitting ? (
                    <View style={styles.submittingRow}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.submitBtnText}>Recording...</Text>
                    </View>
                  ) : (
                    <Text style={styles.submitBtnText}>
                      🚀 Submit to Google Sheet
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>

      {/* ========================================================================= */}
      {/* SUB-MODAL: DROPDOWN SELECTION (Courts, Facilities, Choices)              */}
      {/* ========================================================================= */}
      {activeDropdownField && (
        <Modal
          visible={!!activeDropdownField}
          animationType="fade"
          transparent
          onRequestClose={() => setActiveDropdownField(null)}
        >
          <TouchableWithoutFeedback onPress={() => setActiveDropdownField(null)}>
            <View style={styles.subModalOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.pickerDialog}>
                  <View style={styles.pickerDialogHeader}>
                    <Text style={styles.pickerDialogTitle}>
                      {activeDropdownField.label}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setActiveDropdownField(null)}
                      style={styles.subCloseBtn}
                    >
                      <Text style={styles.subCloseText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView style={styles.pickerOptionsList} showsVerticalScrollIndicator={false}>
                    {(
                      activeDropdownField.options && activeDropdownField.options.length > 0
                        ? activeDropdownField.options
                        : [
                            "Tennis - Court 1",
                            "Tennis - Court 2",
                            "Tennis - Court 3",
                            "Tennis - Court 4",
                            "Badminton - Court 1",
                            "Badminton - Court 2",
                            "Football Turf A",
                            "Basketball Court",
                          ]
                    ).map((opt, i) => {
                      const isSelected = formData[activeDropdownField.label] === opt;
                      return (
                        <TouchableOpacity
                          key={i}
                          style={[styles.optionItem, isSelected && styles.optionItemSelected]}
                          onPress={() => {
                            handleChangeField(activeDropdownField.label, opt, activeDropdownField);
                            setActiveDropdownField(null);
                          }}
                        >
                          <Text
                            style={[
                              styles.optionText,
                              isSelected && styles.optionTextSelected,
                            ]}
                          >
                            {opt}
                          </Text>
                          {isSelected && <Text style={styles.optionCheck}>✓</Text>}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL: INTERACTIVE CALENDAR                                           */}
      {/* ========================================================================= */}
      {activeDateField && (
        <Modal
          visible={!!activeDateField}
          animationType="fade"
          transparent
          onRequestClose={() => setActiveDateField(null)}
        >
          <TouchableWithoutFeedback onPress={() => setActiveDateField(null)}>
            <View style={styles.subModalOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.calendarDialog}>
                  {/* Month Navigation */}
                  <View style={styles.calHeader}>
                    <TouchableOpacity
                      style={styles.calNavBtn}
                      onPress={() => setCalDate(new Date(year, month - 1, 1))}
                    >
                      <Text style={styles.calNavText}>◀</Text>
                    </TouchableOpacity>
                    <Text style={styles.calMonthTitle}>
                      {MONTH_NAMES[month]} {year}
                    </Text>
                    <TouchableOpacity
                      style={styles.calNavBtn}
                      onPress={() => setCalDate(new Date(year, month + 1, 1))}
                    >
                      <Text style={styles.calNavText}>▶</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Quick Shortcut Chips */}
                  <View style={styles.calShortcutsRow}>
                    <TouchableOpacity
                      style={styles.calShortcutChip}
                      onPress={() => handleSelectQuickDate("today")}
                    >
                      <Text style={styles.calShortcutText}>Today</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.calShortcutChip}
                      onPress={() => handleSelectQuickDate("tomorrow")}
                    >
                      <Text style={styles.calShortcutText}>Tomorrow</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.calShortcutChip}
                      onPress={() => handleSelectQuickDate("weekend")}
                    >
                      <Text style={styles.calShortcutText}>This Weekend</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Days of Week Header */}
                  <View style={styles.calWeekdaysRow}>
                    {DAYS_OF_WEEK.map((d, idx) => (
                      <Text key={idx} style={styles.calWeekdayText}>
                        {d}
                      </Text>
                    ))}
                  </View>

                  {/* Days Grid */}
                  <View style={styles.calGrid}>
                    {calendarDays.map((day, idx) => {
                      if (!day) {
                        return <View key={idx} style={styles.calDayCellEmpty} />;
                      }
                      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
                      const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
                      const isSelected = formData[activeDateField.label] === dateStr;

                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[styles.calDayCell, isSelected && styles.calDayCellSelected]}
                          onPress={() => handleSelectDay(day)}
                        >
                          <Text
                            style={[
                              styles.calDayText,
                              isSelected && styles.calDayTextSelected,
                            ]}
                          >
                            {day}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    style={styles.calCloseBtn}
                    onPress={() => setActiveDateField(null)}
                  >
                    <Text style={styles.calCloseBtnText}>Close Calendar</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL: INTERACTIVE TIME SLOT GRID                                     */}
      {/* ========================================================================= */}
      {activeTimeField && (
        <Modal
          visible={!!activeTimeField}
          animationType="fade"
          transparent
          onRequestClose={() => setActiveTimeField(null)}
        >
          <TouchableWithoutFeedback onPress={() => setActiveTimeField(null)}>
            <View style={styles.subModalOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.timeGridDialog}>
                  <View style={styles.pickerDialogHeader}>
                    <View>
                      <Text style={styles.pickerDialogTitle}>Select Time Slot</Text>
                      <Text style={styles.pickerDialogSubtitle}>
                        Duration: {formData["Duration"] || `${durationHours} Hr`}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setActiveTimeField(null)}
                      style={styles.subCloseBtn}
                    >
                      <Text style={styles.subCloseText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                    {/* Morning */}
                    <Text style={styles.timeSectionHeader}>🌅 MORNING SLOTS</Text>
                    <View style={styles.timeSlotGrid}>
                      {MORNING_SLOTS.map((slot, i) => {
                        const isSelected = formData[activeTimeField.label]?.includes(slot);
                        return (
                          <TouchableOpacity
                            key={i}
                            style={[styles.timeSlotCard, isSelected && styles.timeSlotCardSelected]}
                            onPress={() => {
                              handleChangeField(activeTimeField.label, slot, activeTimeField);
                              setActiveTimeField(null);
                            }}
                          >
                            <Text
                              style={[
                                styles.timeSlotText,
                                isSelected && styles.timeSlotTextSelected,
                              ]}
                            >
                              {slot}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Afternoon */}
                    <Text style={styles.timeSectionHeader}>☀️ AFTERNOON SLOTS</Text>
                    <View style={styles.timeSlotGrid}>
                      {AFTERNOON_SLOTS.map((slot, i) => {
                        const isSelected = formData[activeTimeField.label]?.includes(slot);
                        return (
                          <TouchableOpacity
                            key={i}
                            style={[styles.timeSlotCard, isSelected && styles.timeSlotCardSelected]}
                            onPress={() => {
                              handleChangeField(activeTimeField.label, slot, activeTimeField);
                              setActiveTimeField(null);
                            }}
                          >
                            <Text
                              style={[
                                styles.timeSlotText,
                                isSelected && styles.timeSlotTextSelected,
                              ]}
                            >
                              {slot}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Evening */}
                    <Text style={styles.timeSectionHeader}>🌙 EVENING SLOTS</Text>
                    <View style={styles.timeSlotGrid}>
                      {EVENING_SLOTS.map((slot, i) => {
                        const isSelected = formData[activeTimeField.label]?.includes(slot);
                        return (
                          <TouchableOpacity
                            key={i}
                            style={[styles.timeSlotCard, isSelected && styles.timeSlotCardSelected]}
                            onPress={() => {
                              handleChangeField(activeTimeField.label, slot, activeTimeField);
                              setActiveTimeField(null);
                            }}
                          >
                            <Text
                              style={[
                                styles.timeSlotText,
                                isSelected && styles.timeSlotTextSelected,
                              ]}
                            >
                              {slot}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "88%",
    minHeight: "50%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 24,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F2F5",
  },
  dragPill: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CFD8DC",
    alignSelf: "center",
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 22,
  },
  titleTextGroup: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111B21",
  },
  sheetTabBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#E0F2F1",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    marginTop: 3,
  },
  sheetTabText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#00796B",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F0F2F5",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  closeBtnText: {
    fontSize: 15,
    color: "#54656F",
    fontWeight: "700",
  },
  autoPopulatedBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    borderWidth: 1,
    borderColor: "#A5D6A7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 10,
    gap: 8,
  },
  autoPopulatedIcon: {
    fontSize: 14,
  },
  autoPopulatedText: {
    fontSize: 12,
    color: "#1B5E20",
    flex: 1,
  },
  autoPopulatedBold: {
    fontWeight: "700",
  },
  description: {
    fontSize: 13,
    color: "#667781",
    marginTop: 8,
    lineHeight: 18,
  },
  formScroll: {
    flex: 1,
  },
  formScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111B21",
  },
  requiredStar: {
    color: "#E53935",
    fontWeight: "700",
  },
  reqBadge: {
    fontSize: 11,
    color: "#C62828",
    fontWeight: "500",
  },
  optBadge: {
    fontSize: 11,
    color: "#8696A0",
  },
  input: {
    backgroundColor: "#F7F8FA",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111B21",
  },
  textarea: {
    minHeight: 80,
    paddingTop: 10,
  },
  inputError: {
    borderColor: "#E53935",
    backgroundColor: "#FFEBEE",
  },
  errorText: {
    fontSize: 12,
    color: "#E53935",
    marginTop: 4,
    marginLeft: 2,
  },
  inputWithIconWrapper: {
    position: "relative",
  },
  phoneKeyBadge: {
    position: "absolute",
    right: 10,
    top: 10,
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  phoneKeyBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2E7D32",
  },

  // Specialized Duration Widget
  durationCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 14,
  },
  durationHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#EDF2F7",
    paddingBottom: 8,
    marginBottom: 12,
  },
  durationValueText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  durationSubText: {
    fontSize: 12,
    color: "#64748B",
  },
  durationControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  hourStepperContainer: {
    flex: 1,
    alignItems: "center",
  },
  stepperLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  stepperPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderRadius: 24,
    paddingHorizontal: 4,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#00A884",
  },
  stepperCurrentValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginHorizontal: 12,
  },

  // Circular Minute Clock Dial
  circularDialWrapper: {
    alignItems: "center",
  },
  circularClockPlate: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#F1F5F9",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  clockCenterHub: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  clockCenterText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#00A884",
  },
  radialBtn: {
    position: "absolute",
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#94A3B8",
    alignItems: "center",
    justifyContent: "center",
  },
  radialTop: {
    top: 2,
    alignSelf: "center",
  },
  radialRight: {
    right: 2,
    top: 36,
  },
  radialBottom: {
    bottom: 2,
    alignSelf: "center",
  },
  radialLeft: {
    left: 2,
    top: 36,
  },
  radialActive: {
    backgroundColor: "#00A884",
    borderColor: "#008F6F",
  },
  radialText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#475569",
  },
  radialTextActive: {
    color: "#FFFFFF",
  },

  // Sub Pickers Triggers
  pickerTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F7F8FA",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerTriggerSelected: {
    backgroundColor: "#F4FDF9",
    borderColor: "#A5D6A7",
  },
  pickerTriggerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  pickerTriggerIcon: {
    fontSize: 16,
  },
  pickerTriggerText: {
    fontSize: 14,
    color: "#111B21",
    fontWeight: "500",
    flex: 1,
  },
  pickerTriggerPlaceholder: {
    color: "#8696A0",
  },
  pickerTriggerArrow: {
    fontSize: 12,
    color: "#8696A0",
  },
  pickerTriggerAction: {
    fontSize: 12,
    fontWeight: "700",
    color: "#00A884",
  },

  // Boolean buttons
  booleanRow: {
    flexDirection: "row",
    gap: 12,
  },
  boolBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CFD8DC",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  boolBtnActive: {
    backgroundColor: "#E8F5E9",
    borderColor: "#00A884",
  },
  boolBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#54656F",
  },
  boolBtnTextActive: {
    color: "#00796B",
    fontWeight: "700",
  },

  // Dual sync notice
  syncNoteCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F4FDF9",
    borderWidth: 1,
    borderColor: "#C8E6C9",
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
    marginBottom: 12,
    gap: 10,
  },
  syncNoteIcon: {
    fontSize: 16,
  },
  syncNoteText: {
    flex: 1,
    fontSize: 12,
    color: "#2E7D32",
    lineHeight: 16,
  },

  // Footer
  footer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#F0F2F5",
    backgroundColor: "#FFFFFF",
    gap: 12,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CFD8DC",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#54656F",
  },
  submitBtn: {
    flex: 1,
    backgroundColor: "#00A884",
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#00A884",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  submittingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  // Sub-modal overlay & containers
  subModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  pickerDialog: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 20,
  },
  pickerDialogHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F2F5",
  },
  pickerDialogTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111B21",
  },
  pickerDialogSubtitle: {
    fontSize: 12,
    color: "#667781",
    marginTop: 2,
  },
  subCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F0F2F5",
    alignItems: "center",
    justifyContent: "center",
  },
  subCloseText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#54656F",
  },
  pickerOptionsList: {
    maxHeight: 280,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 4,
  },
  optionItemSelected: {
    backgroundColor: "#E8F5E9",
  },
  optionText: {
    fontSize: 14,
    color: "#111B21",
  },
  optionTextSelected: {
    color: "#00796B",
    fontWeight: "700",
  },
  optionCheck: {
    fontSize: 14,
    color: "#00A884",
    fontWeight: "700",
  },

  // Calendar Dialog
  calendarDialog: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 20,
  },
  calHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  calNavBtn: {
    padding: 8,
  },
  calNavText: {
    fontSize: 14,
    color: "#00A884",
    fontWeight: "700",
  },
  calMonthTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111B21",
  },
  calShortcutsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  calShortcutChip: {
    backgroundColor: "#F0F2F5",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  calShortcutText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#00796B",
  },
  calWeekdaysRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F2F5",
    paddingBottom: 6,
  },
  calWeekdayText: {
    width: 36,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: "#8696A0",
  },
  calGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  calDayCell: {
    width: "14.28%",
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 2,
    borderRadius: 18,
  },
  calDayCellSelected: {
    backgroundColor: "#00A884",
  },
  calDayCellEmpty: {
    width: "14.28%",
    height: 36,
  },
  calDayText: {
    fontSize: 13,
    color: "#111B21",
  },
  calDayTextSelected: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  calCloseBtn: {
    marginTop: 14,
    paddingVertical: 10,
    backgroundColor: "#F0F2F5",
    borderRadius: 8,
    alignItems: "center",
  },
  calCloseBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#54656F",
  },

  // Time Grid Dialog
  timeGridDialog: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 20,
  },
  timeSectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8696A0",
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 8,
  },
  timeSlotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
  },
  timeSlotCard: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F5F6F6",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  timeSlotCardSelected: {
    backgroundColor: "#00A884",
    borderColor: "#008F6F",
  },
  timeSlotText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111B21",
  },
  timeSlotTextSelected: {
    color: "#FFFFFF",
  },
});
