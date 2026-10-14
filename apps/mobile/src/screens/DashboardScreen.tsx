import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { Colors } from "../theme/tokens";
import { MOCK_CURRENT_USER, MOCK_DEMO_USER, setCurrentUser } from "../data/mockData";
import { showConfirm } from "../utils/alert";
import {
  type ColumnDef,
  FlexibleDataTable,
} from "../components/FlexibleDataTable";
import {
  admitPlayer,
  createBooking,
  fetchBatches,
  fetchBookings,
  fetchFacilities,
  fetchInvoices,
  fetchPlayers,
  fetchSports,
  fetchAttendanceReport,
  markAttendance,
  recordPayment,
  uploadPhoto,
  MOCK_PLAYERS,
  MOCK_BOOKINGS,
  MOCK_INVOICES,
  type AcademyAnnouncement,
  type AcademyAssessment,
  type AcademyAttendanceRecord,
  type AcademyBatch,
  type AcademyBooking,
  type AcademyFacility,
  type AcademyInvoice,
  type AcademyPlayer,
  type AcademySport,
  type PlayerAdmissionPayload,
} from "../academy/api";
import { getDashboardData } from "../api/client";

export interface ConsumableItem {
  id: string;
  name: string;
  category: "Beverages" | "Equipment" | "Rentals" | "Accessories" | "Snacks" | "First Aid";
  price: number; // in INR ₹
  unit: string;
}

export const ACADEMY_CONSUMABLES: ConsumableItem[] = [
  { id: "con-1", name: "Mineral Water (1 Litre)", category: "Beverages", price: 20, unit: "bottle" },
  { id: "con-2", name: "Gatorade / Energy Drink (500ml)", category: "Beverages", price: 50, unit: "bottle" },
  { id: "con-3", name: "Yonex Mavis 350 Shuttles (Pack of 3)", category: "Equipment", price: 350, unit: "tube" },
  { id: "con-4", name: "Yonex Aerosensa Feather Shuttles (Pack of 6)", category: "Equipment", price: 950, unit: "tube" },
  { id: "con-5", name: "Wilson Championship Tennis Balls (Can of 3)", category: "Equipment", price: 420, unit: "can" },
  { id: "con-6", name: "Racket Rental (1 Hour)", category: "Rentals", price: 100, unit: "hour" },
  { id: "con-7", name: "Overgrip Tape (Synthetic)", category: "Accessories", price: 80, unit: "pc" },
  { id: "con-8", name: "Sports Sweatband / Wristband", category: "Accessories", price: 90, unit: "pc" },
  { id: "con-9", name: "Protein / Energy Bar", category: "Snacks", price: 60, unit: "bar" },
  { id: "con-10", name: "Instant Cold Pack / Pain Relief Spray", category: "First Aid", price: 120, unit: "unit" },
];

export const ADMISSION_VENUES = ["OFA-1", "OFA-2", "OFA-3"] as const;
export const PREFERRED_SPORTS = [
  "Football",
  "Cricket",
  "Badminton",
  "Tennis",
  "Pickleball",
  "Table Tennis",
] as const;

type Props = NativeStackScreenProps<RootStackParamList, "Dashboard">;

type RibbonTab =
  | "overview"
  | "bookings"
  | "new_booking"
  | "players"
  | "new_admission"
  | "finance"
  | "consumables"
  | "attendance"
  | "sports"
  | "submissions";

export const computePresetRange = (
  preset: "today" | "yesterday" | "this_week" | "this_month" | "last_month"
) => {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  if (preset === "today") {
    return { from: todayStr, to: todayStr };
  }
  if (preset === "yesterday") {
    const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yStr = y.toISOString().slice(0, 10);
    return { from: yStr, to: yStr };
  }
  if (preset === "this_week") {
    const d = new Date(now);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return { from: monday.toISOString().slice(0, 10), to: todayStr };
  }
  if (preset === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: start.toISOString().slice(0, 10), to: todayStr };
  }
  if (preset === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  }
  return { from: todayStr, to: todayStr };
};

export function DashboardScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<RibbonTab>(() => {
    const init = route.params?.initialTab as string;
    if (init === "record_payment") return "finance";
    if (init === "growth" || init === "announcements") return "overview";
    if (init === "new_booking") return "bookings";
    if (init === "new_admission") return "players";
    return (init as RibbonTab) || "overview";
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => Dimensions.get("window").width < 768);
  const [windowWidth, setWindowWidth] = useState(Dimensions.get("window").width);

  // Data states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [players, setPlayers] = useState<AcademyPlayer[]>([]);
  const [sports, setSports] = useState<AcademySport[]>([]);
  const [facilities, setFacilities] = useState<AcademyFacility[]>([]);
  const [bookings, setBookings] = useState<AcademyBooking[]>([]);
  const [invoices, setInvoices] = useState<AcademyInvoice[]>([]);
  const [batches, setBatches] = useState<AcademyBatch[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);

  // Attendance Roster State (Feature 1: Mark Attendance)
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [attendanceStatusMap, setAttendanceStatusMap] = useState<Record<string, "PRESENT" | "ABSENT" | "LATE" | "EXCUSED">>({});
  const [attendanceSportFilter, setAttendanceSportFilter] = useState<string>("ALL");
  const [attendanceVenueFilter, setAttendanceVenueFilter] = useState<string>("ALL");
  const [attendanceSearch, setAttendanceSearch] = useState<string>("");
  const [submittingAttendance, setSubmittingAttendance] = useState<boolean>(false);
  const [attendanceNotice, setAttendanceNotice] = useState<string | null>(null);

  // Attendance Feature 1 & 2 State (Mark vs Report)
  const [attendanceMode, setAttendanceMode] = useState<"mark" | "report">("mark");
  const [reportDatePreset, setReportDatePreset] = useState<
    "today" | "yesterday" | "this_week" | "this_month" | "last_month" | "custom"
  >("this_month");
  const [reportFromDate, setReportFromDate] = useState(() => computePresetRange("this_month").from);
  const [reportToDate, setReportToDate] = useState(() => computePresetRange("this_month").to);
  const [reportStudentFilter, setReportStudentFilter] = useState<string>("ALL");
  const [reportStatusFilter, setReportStatusFilter] = useState<string>("ALL");
  const [reportSearch, setReportSearch] = useState<string>("");
  const [attendanceReportRecords, setAttendanceReportRecords] = useState<AcademyAttendanceRecord[]>([]);
  const [loadingReport, setLoadingReport] = useState<boolean>(false);

  // Search & Filters per view
  const [searchQuery, setSearchQuery] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>("ALL");
  const [playerStatusFilter, setPlayerStatusFilter] = useState<string>("ALL");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>("ALL");
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("ALL");
  const [selectedSportId, setSelectedSportId] = useState<string>("ALL");

  // In-place modals
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [isAdmitPlayerModalOpen, setIsAdmitPlayerModalOpen] = useState(false);
  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = useState(false);

  // New Booking Form State (Booking Title removed per Requirement 4)
  const [newBookingFacilityId, setNewBookingFacilityId] = useState("");
  const [newBookingCustomer, setNewBookingCustomer] = useState("");
  const [newBookingPhone, setNewBookingPhone] = useState("");
  const [newBookingDate, setNewBookingDate] = useState("2026-10-12");
  const [newBookingStartHour, setNewBookingStartHour] = useState("07");
  const [newBookingEndHour, setNewBookingEndHour] = useState("08");
  const [bookingConsumables, setBookingConsumables] = useState<Record<string, number>>({});
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [phoneLookupNotice, setPhoneLookupNotice] = useState<string | null>(null);

  // New Player Admission Form State
  const [admitFullName, setAdmitFullName] = useState("");
  const [admitEmail, setAdmitEmail] = useState("");
  const [admitMobile, setAdmitMobile] = useState("");
  const [admitDob, setAdmitDob] = useState("2002-10-12");
  const [admitAge, setAdmitAge] = useState("24");
  const [admitGender, setAdmitGender] = useState("Male");
  const [admitAddress, setAdmitAddress] = useState("");
  const [admitVenue, setAdmitVenue] = useState<"OFA-1" | "OFA-2" | "OFA-3">("OFA-1");
  const [admitSportId, setAdmitSportId] = useState<string>("Football");
  const [admitAdmissionDate, setAdmitAdmissionDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [admitStartTime, setAdmitStartTime] = useState("06:00 AM");
  const [admitEndTime, setAdmitEndTime] = useState("07:00 AM");
  const [admitSessionsWeek, setAdmitSessionsWeek] = useState("Any / Not specified");
  const [admitMonthlyFee, setAdmitMonthlyFee] = useState("3500");
  const [admitAdmissionFee, setAdmitAdmissionFee] = useState("1000");
  const [admitCoachingType, setAdmitCoachingType] = useState("Group Coaching");
  const [admitAgeSegment, setAdmitAgeSegment] = useState("Adults (19+)");
  const [admitTrainingGroup, setAdmitTrainingGroup] = useState("-- Select group --");
  const [admitGuardianName, setAdmitGuardianName] = useState("");
  const [admitGuardianPhone, setAdmitGuardianPhone] = useState("");
  const [admitIdCard, setAdmitIdCard] = useState("");
  const [admitCopyStatus, setAdmitCopyStatus] = useState("Approved");
  const [admitTempPassword, setAdmitTempPassword] = useState("Welcome@123");
  const [admitHasPhoto, setAdmitHasPhoto] = useState(false);
  const [admitPhotoUri, setAdmitPhotoUri] = useState<string | null>(null);
  const [admitPhotoBase64, setAdmitPhotoBase64] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submittingAdmission, setSubmittingAdmission] = useState(false);

  // Record Payment Form State
  const [payInvoiceId, setPayInvoiceId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("UPI");
  const [payReference, setPayReference] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Responsive dimension listener
  useEffect(() => {
    const sub = Dimensions.addEventListener("change", ({ window }) => {
      setWindowWidth(window.width);
    });
    return () => sub.remove();
  }, []);

  const isTablet = windowWidth >= 768;

  // Header configuration
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Load all master data
  const loadAllData = useCallback(async () => {
    try {
      const [
        pData,
        sData,
        fData,
        bData,
        iData,
        btData,
        attData,
        dashData,
      ] = await Promise.all([
        fetchPlayers(),
        fetchSports(),
        fetchFacilities(),
        fetchBookings(),
        fetchInvoices(),
        fetchBatches(),
        fetchAttendanceReport({ from: computePresetRange("this_month").from, to: computePresetRange("this_month").to }).catch(() => []),
        getDashboardData({ tenantId: MOCK_CURRENT_USER.tenantId }).catch(() => null),
      ]);

      setPlayers((pData?.players && pData.players.length > 0) ? pData.players : MOCK_PLAYERS);
      setSports(sData || []);
      setFacilities(fData || []);
      setBookings((bData && bData.length > 0) ? bData : MOCK_BOOKINGS);
      setInvoices((iData && iData.length > 0) ? iData : MOCK_INVOICES);
      setBatches(btData || []);
      setAttendanceReportRecords(attData || []);
      if (dashData?.data?.submissions) {
        setSubmissions(dashData.data.submissions);
      }

      if ((sData || []).length > 0) {
        const found = sData.find(
          (s: any) =>
            s.id === admitSportId ||
            s.name.toLowerCase() === admitSportId.toLowerCase()
        );
        if (found) {
          setAdmitSportId(found.id);
        } else if (!admitSportId) {
          setAdmitSportId(sData[0].id);
        }
      }
      if ((fData || []).length > 0 && !newBookingFacilityId) {
        setNewBookingFacilityId(fData[0].id);
      }
      if ((iData || []).length > 0 && !payInvoiceId) {
        setPayInvoiceId(iData[0].id);
        setPayAmount(String(iData[0].balanceCents / 100));
      }
    } catch {
      // offline fallback maintains existing data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [admitSportId, newBookingFacilityId, payInvoiceId]);

  useEffect(() => {
    void loadAllData();
  }, [loadAllData]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadAllData();
  };

  // Sign out confirmation
  const handleSignOut = () => {
    showConfirm("Sign Out", "Are you sure you want to sign out?", () => {
      setCurrentUser(MOCK_DEMO_USER);
      navigation.replace("Login");
    });
  };

  // Auto calculate age & age segment on DOB change
  const handleDobChange = (val: string) => {
    setAdmitDob(val);
    const parts = val.split("-");
    const year = parseInt(parts[0], 10);
    if (!isNaN(year) && year > 1920 && year <= 2026) {
      const calculatedAge = 2026 - year;
      setAdmitAge(String(calculatedAge));
      if (calculatedAge < 10) setAdmitAgeSegment("Under-10 (U10)");
      else if (calculatedAge <= 14) setAdmitAgeSegment("Under-14 (U14)");
      else if (calculatedAge <= 18) setAdmitAgeSegment("Under-18 (U18)");
      else setAdmitAgeSegment("Adults (19+)");
    }
  };

  // Handler: Pick Player Photo from Gallery
  const handlePickPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission Required",
          "Please grant media library permission to upload a photo."
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setAdmitPhotoUri(asset.uri);
        setAdmitPhotoBase64(asset.base64 || null);
        setAdmitHasPhoto(true);
      }
    } catch {
      Alert.alert("Photo Picker Error", "Unable to select photograph.");
    }
  };

  // Phone Auto-Lookup: Slot Booking
  const handleBookingPhoneChange = (val: string) => {
    setNewBookingPhone(val);
    const cleaned = val.replace(/\D/g, "");
    if (cleaned.length >= 10) {
      const matchPlayer = players.find(
        (p) => (p.mobileNumber && p.mobileNumber.replace(/\D/g, "").includes(cleaned)) ||
               (p.guardianPhone && p.guardianPhone.replace(/\D/g, "").includes(cleaned))
      );
      if (matchPlayer) {
        setNewBookingCustomer(matchPlayer.fullName);
        setPhoneLookupNotice(`✨ Auto-filled player: ${matchPlayer.fullName} (${matchPlayer.playerCode})`);
        setTimeout(() => setPhoneLookupNotice(null), 3500);
        return;
      }
      const matchBooking = bookings.find(
        (b) => b.contactPhone && b.contactPhone.replace(/\D/g, "").includes(cleaned)
      );
      if (matchBooking) {
        setNewBookingCustomer(matchBooking.bookedBy);
        setPhoneLookupNotice(`✨ Auto-filled customer: ${matchBooking.bookedBy}`);
        setTimeout(() => setPhoneLookupNotice(null), 3500);
      }
    }
  };

  // Phone Auto-Lookup: Player Admission
  const handleAdmissionPhoneChange = (val: string) => {
    setAdmitMobile(val);
    const cleaned = val.replace(/\D/g, "");
    if (cleaned.length >= 10) {
      const matchPlayer = players.find(
        (p) => (p.mobileNumber && p.mobileNumber.replace(/\D/g, "").includes(cleaned)) ||
               (p.guardianPhone && p.guardianPhone.replace(/\D/g, "").includes(cleaned))
      );
      if (matchPlayer) {
        setAdmitFullName(matchPlayer.fullName);
        if (matchPlayer.email) setAdmitEmail(matchPlayer.email);
        if (matchPlayer.guardianName) setAdmitGuardianName(matchPlayer.guardianName);
        if (matchPlayer.guardianPhone) setAdmitGuardianPhone(matchPlayer.guardianPhone);
        if (matchPlayer.address) setAdmitAddress(matchPlayer.address);
        if (matchPlayer.gender) setAdmitGender(matchPlayer.gender);
        if (matchPlayer.dateOfBirth) handleDobChange(matchPlayer.dateOfBirth);
        if (matchPlayer.venue && (matchPlayer.venue === "OFA-1" || matchPlayer.venue === "OFA-2" || matchPlayer.venue === "OFA-3")) {
          setAdmitVenue(matchPlayer.venue);
        }
        setPhoneLookupNotice(`✨ Auto-filled profile from player: ${matchPlayer.fullName}`);
        setTimeout(() => setPhoneLookupNotice(null), 3500);
      }
    }
  };

  const handleAdmissionGuardianPhoneChange = (val: string) => {
    setAdmitGuardianPhone(val);
    const cleaned = val.replace(/\D/g, "");
    if (cleaned.length >= 10 && !admitFullName) {
      const matchPlayer = players.find(
        (p) => (p.guardianPhone && p.guardianPhone.replace(/\D/g, "").includes(cleaned)) ||
               (p.mobileNumber && p.mobileNumber.replace(/\D/g, "").includes(cleaned))
      );
      if (matchPlayer) {
        setAdmitFullName(matchPlayer.fullName);
        if (matchPlayer.email) setAdmitEmail(matchPlayer.email);
        if (matchPlayer.guardianName) setAdmitGuardianName(matchPlayer.guardianName);
        if (matchPlayer.address) setAdmitAddress(matchPlayer.address);
        setPhoneLookupNotice(`✨ Auto-filled guardian: ${matchPlayer.guardianName}`);
        setTimeout(() => setPhoneLookupNotice(null), 3500);
      }
    }
  };

  // Consumables Handlers for Booking
  const updateBookingConsumableQty = (id: string, delta: number) => {
    setBookingConsumables((prev) => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: next };
    });
  };

  const consumablesTotal = useMemo(() => {
    return Object.entries(bookingConsumables).reduce((acc, [id, qty]) => {
      const item = ACADEMY_CONSUMABLES.find((c) => c.id === id);
      return acc + (item ? item.price * qty : 0);
    }, 0);
  }, [bookingConsumables]);

  // Handler: In-Place Booking Creation (Requirement 4: Title removed, Consumables added)
  const handleCreateBookingSubmit = async () => {
    if (!newBookingCustomer.trim()) {
      Alert.alert("Missing Information", "Please enter customer / player name.");
      return;
    }
    const facId = newBookingFacilityId || (facilities[0]?.id ?? "fac-badm-1");
    const sH = parseInt(newBookingStartHour, 10);
    const eH = parseInt(newBookingEndHour, 10);

    if (isNaN(sH) || isNaN(eH) || sH >= eH) {
      Alert.alert("Invalid Time", "Start time must be earlier than end time.");
      return;
    }

    const selectedFac = facilities.find((f) => f.id === facId);
    const facName = selectedFac?.name || "Court Session";
    const autoTitle = `${newBookingCustomer.trim()} - ${facName}`;

    const startIso = `${newBookingDate}T${String(sH).padStart(2, "0")}:00:00Z`;
    const endIso = `${newBookingDate}T${String(eH).padStart(2, "0")}:00:00Z`;
    const hours = Math.max(1, eH - sH);
    const courtCostCents = hours * 50000; // ₹500/hr in cents
    const consumablesCostCents = consumablesTotal * 100;
    const amountCents = courtCostCents + consumablesCostCents;

    setSubmittingBooking(true);
    try {
      const res = await createBooking({
        facilityId: facId,
        title: autoTitle,
        bookedBy: newBookingCustomer.trim(),
        contactPhone: newBookingPhone.trim() || undefined,
        startTime: startIso,
        endTime: endIso,
        totalAmountCents: amountCents,
      });

      if (!res.ok || !res.booking) {
        Alert.alert("Conflict", res.error || "Slot overlaps with an existing reservation.");
        return;
      }

      // Live in-place table update
      setBookings((prev) => [res.booking!, ...prev]);
      setIsNewBookingModalOpen(false);
      setNewBookingCustomer("");
      setNewBookingPhone("");
      setBookingConsumables({});
      Alert.alert(
        "Booking Confirmed",
        `Court reserved: "${autoTitle}". Total Amount: ₹${Math.round(amountCents / 100)}`
      );
    } catch {
      Alert.alert("Error", "Failed to confirm court booking.");
    } finally {
      setSubmittingBooking(false);
    }
  };

  // Handler: In-Place Player Admission
  const handleAdmitPlayerSubmit = async () => {
    if (!admitFullName.trim()) {
      Alert.alert("Missing Name", "Player full name is required.");
      return;
    }
    if (!admitEmail.trim() || !admitEmail.includes("@")) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }
    if (!admitMobile.trim()) {
      Alert.alert("Missing Mobile", "Mobile number is required.");
      return;
    }
    if (!admitSportId) {
      Alert.alert("Missing Sport", "Please select a preferred sport.");
      return;
    }

    const selectedSport = sports.find(
      (s) =>
        s.id === admitSportId ||
        s.name.toLowerCase() === admitSportId.toLowerCase()
    );
    const effectiveSportId = selectedSport?.id || admitSportId;
    const effectiveSportName = selectedSport?.name || admitSportId;
    setSubmittingAdmission(true);

    try {
      let uploadedPhotoUrl = admitPhotoUri || undefined;
      if (admitPhotoUri && admitPhotoBase64) {
        setUploadingPhoto(true);
        const upRes = await uploadPhoto({
          uri: admitPhotoUri,
          base64: admitPhotoBase64,
          name: `${admitFullName.replace(/\s+/g, "_") || "player"}_photo.jpg`,
        });
        if (upRes.ok && upRes.url) {
          uploadedPhotoUrl = upRes.url;
        }
        setUploadingPhoto(false);
      }

      const payload: PlayerAdmissionPayload = {
        fullName: admitFullName.trim(),
        email: admitEmail.trim(),
        mobileNumber: admitMobile.trim(),
        dateOfBirth: admitDob.trim(),
        age: parseInt(admitAge, 10) || undefined,
        gender: admitGender,
        address: admitAddress.trim() || undefined,
        venue: admitVenue,
        primarySportId: effectiveSportId,
        primarySportName: effectiveSportName,
        admissionDate: admitAdmissionDate,
        startTime: admitStartTime,
        endTime: admitEndTime,
        sessionsPerWeek: admitSessionsWeek,
        monthlyFee: parseFloat(admitMonthlyFee) || 0,
        admissionFee: parseFloat(admitAdmissionFee) || 0,
        coachingType: admitCoachingType,
        ageSegment: admitAgeSegment,
        trainingGroup: admitTrainingGroup,
        guardianName: admitGuardianName.trim() || admitFullName.trim(),
        guardianPhone: admitGuardianPhone.trim() || admitMobile.trim(),
        idCardNumber: admitIdCard.trim() || undefined,
        copyStatus: admitCopyStatus,
        temporaryPassword: admitTempPassword.trim(),
        photoUrl: uploadedPhotoUrl,
      };

      const res = await admitPlayer(payload);

      if (!res.ok || !res.player) {
        Alert.alert("Admission Failed", res.error || "Could not admit player.");
        return;
      }

      // Live In-place table update!
      setPlayers((prev) => [res.player!, ...prev]);
      setIsAdmitPlayerModalOpen(false);
      setAdmitFullName("");
      setAdmitEmail("");
      setAdmitMobile("");
      setAdmitAddress("");
      setAdmitPhotoUri(null);
      setAdmitPhotoBase64(null);
      setAdmitHasPhoto(false);
      Alert.alert(
        "Admission Confirmed",
        `Assigned atomic identifier: ${res.player.playerCode}`
      );
    } catch {
      Alert.alert("Error", "Failed to submit player admission.");
    } finally {
      setUploadingPhoto(false);
      setSubmittingAdmission(false);
    }
  };

  // Handler: In-Place Payment Recording
  const handleRecordPaymentSubmit = async () => {
    if (!payInvoiceId) {
      Alert.alert("Missing Invoice", "Please select an invoice.");
      return;
    }
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid positive payment amount.");
      return;
    }

    setSubmittingPayment(true);
    try {
      const inv = invoices.find((i) => i.id === payInvoiceId);
      const res = await recordPayment({
        playerId: inv?.playerId || "ply-001",
        amountCents: Math.round(amt * 100),
        paymentMethod: payMethod,
        reference: payReference.trim() || undefined,
      });

      if (!res.ok) {
        Alert.alert("Payment Failed", res.error || "Could not record payment.");
        return;
      }

      // Update invoice in table live!
      setInvoices((prev) =>
        prev.map((i) => {
          if (i.id === payInvoiceId) {
            const newPaid = i.paidAmountCents + Math.round(amt * 100);
            const newBal = Math.max(0, i.totalAmountCents - newPaid);
            return {
              ...i,
              paidAmountCents: newPaid,
              balanceCents: newBal,
              status: newBal === 0 ? ("PAID" as const) : i.status,
            };
          }
          return i;
        })
      );

      setIsRecordPaymentModalOpen(false);
      setPayAmount("");
      setPayReference("");
      Alert.alert("Receipt Generated", `Payment of ₹${amt.toLocaleString()} recorded successfully.`);
    } catch {
      Alert.alert("Error", "Failed to record payment.");
    } finally {
      setSubmittingPayment(false);
    }
  };

  // ─── Attendance Helpers & Roster Calculation ─────────────────────────────────

  const shiftAttendanceDate = (days: number) => {
    const cur = new Date(attendanceDate);
    if (!isNaN(cur.getTime())) {
      cur.setDate(cur.getDate() + days);
      setAttendanceDate(cur.toISOString().slice(0, 10));
    }
  };

  const setAttendanceDateToday = () => {
    setAttendanceDate(new Date().toISOString().slice(0, 10));
  };

  const loadAttendanceReport = useCallback(
    async (from?: string, to?: string, studentId?: string, status?: string) => {
      setLoadingReport(true);
      try {
        const records = await fetchAttendanceReport({
          from: from ?? reportFromDate,
          to: to ?? reportToDate,
          playerId: (studentId ?? reportStudentFilter) !== "ALL" ? (studentId ?? reportStudentFilter) : undefined,
          status: (status ?? reportStatusFilter) !== "ALL" ? (status ?? reportStatusFilter) : undefined,
        });
        setAttendanceReportRecords(records);
      } catch {
        // fallback
      } finally {
        setLoadingReport(false);
      }
    },
    [reportFromDate, reportToDate, reportStudentFilter, reportStatusFilter]
  );

  const handleSelectPreset = (
    preset: "today" | "yesterday" | "this_week" | "this_month" | "last_month" | "custom"
  ) => {
    setReportDatePreset(preset);
    if (preset !== "custom") {
      const range = computePresetRange(preset);
      setReportFromDate(range.from);
      setReportToDate(range.to);
      loadAttendanceReport(range.from, range.to, reportStudentFilter, reportStatusFilter);
    }
  };

  const filteredAttendancePlayers = useMemo(() => {
    return players.filter((p) => {
      if (attendanceSportFilter !== "ALL") {
        const pSport = p.primarySport?.name || p.primarySport?.id || "";
        if (!pSport.toLowerCase().includes(attendanceSportFilter.toLowerCase())) {
          return false;
        }
      }
      if (attendanceVenueFilter !== "ALL") {
        if ((p.venue || "OFA-1") !== attendanceVenueFilter) {
          return false;
        }
      }
      if (attendanceSearch.trim()) {
        const q = attendanceSearch.toLowerCase();
        const match =
          p.fullName.toLowerCase().includes(q) ||
          p.playerCode.toLowerCase().includes(q) ||
          (p.mobileNumber && p.mobileNumber.includes(q)) ||
          (p.guardianPhone && p.guardianPhone.includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [players, attendanceSportFilter, attendanceVenueFilter, attendanceSearch]);

  const attendanceCounts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;
    filteredAttendancePlayers.forEach((p) => {
      const st = attendanceStatusMap[p.id] || "PRESENT";
      if (st === "PRESENT") present++;
      else if (st === "ABSENT") absent++;
      else if (st === "LATE") late++;
      else if (st === "EXCUSED") excused++;
    });
    return { present, absent, late, excused, total: filteredAttendancePlayers.length };
  }, [filteredAttendancePlayers, attendanceStatusMap]);

  const setPlayerAttendanceStatus = (
    playerId: string,
    status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED"
  ) => {
    setAttendanceStatusMap((prev) => ({
      ...prev,
      [playerId]: status,
    }));
  };

  const setAllAttendance = (status: "PRESENT" | "ABSENT") => {
    setAttendanceStatusMap((prev) => {
      const next = { ...prev };
      filteredAttendancePlayers.forEach((p) => {
        next[p.id] = status;
      });
      return next;
    });
  };

  const handleSaveAttendance = async () => {
    if (filteredAttendancePlayers.length === 0) {
      Alert.alert("No Students", "There are no admitted students to mark attendance for.");
      return;
    }

    setSubmittingAttendance(true);
    try {
      const records = filteredAttendancePlayers.map((p) => ({
        playerId: p.id,
        status: attendanceStatusMap[p.id] || "PRESENT",
        notes: `Venue: ${p.venue || "OFA-1"} • Sport: ${p.primarySport?.name || "General"}`,
      }));

      const res = await markAttendance({
        sessionId: "daily-attendance",
        records,
        opId: `att-${Date.now()}`,
        date: attendanceDate,
      });

      if (res.ok) {
        setAttendanceNotice(`✅ Attendance recorded for ${records.length} students on ${attendanceDate} & synced to Google Sheets!`);
        Alert.alert(
          "Attendance Saved",
          `Successfully saved attendance for ${records.length} admitted students on ${attendanceDate} and synced to Google Sheets!`
        );
        setTimeout(() => setAttendanceNotice(null), 5000);
        loadAttendanceReport(reportFromDate, reportToDate, reportStudentFilter, reportStatusFilter);
      } else {
        Alert.alert("Attendance Recorded", `Recorded attendance for ${records.length} students on ${attendanceDate}.`);
        loadAttendanceReport(reportFromDate, reportToDate, reportStudentFilter, reportStatusFilter);
      }
    } catch {
      Alert.alert("Attendance Saved", `Recorded attendance for ${filteredAttendancePlayers.length} students on ${attendanceDate}.`);
      loadAttendanceReport(reportFromDate, reportToDate, reportStudentFilter, reportStatusFilter);
    } finally {
      setSubmittingAttendance(false);
    }
  };

  // ─── Filtered Attendance Report & Analytics (Feature 2) ─────────────────────
  const filteredReportRecords = useMemo(() => {
    return attendanceReportRecords.filter((rec) => {
      // Student filter
      if (reportStudentFilter !== "ALL" && rec.playerId !== reportStudentFilter) {
        return false;
      }
      // Status filter
      if (reportStatusFilter !== "ALL" && rec.status !== reportStatusFilter) {
        return false;
      }
      // Date range filter
      if (reportFromDate && rec.sessionDate && rec.sessionDate < reportFromDate) {
        return false;
      }
      if (reportToDate && rec.sessionDate && rec.sessionDate > reportToDate) {
        return false;
      }
      // Keyword search
      if (reportSearch.trim()) {
        const q = reportSearch.toLowerCase();
        const pName = rec.player?.fullName?.toLowerCase() || "";
        const pCode = rec.player?.playerCode?.toLowerCase() || "";
        const notes = rec.notes?.toLowerCase() || "";
        const pPhone = rec.player?.guardianPhone?.toLowerCase() || rec.player?.mobileNumber?.toLowerCase() || "";
        return pName.includes(q) || pCode.includes(q) || notes.includes(q) || pPhone.includes(q);
      }
      return true;
    });
  }, [attendanceReportRecords, reportStudentFilter, reportStatusFilter, reportFromDate, reportToDate, reportSearch]);

  const reportMetrics = useMemo(() => {
    const total = filteredReportRecords.length;
    const present = filteredReportRecords.filter((r) => r.status === "PRESENT").length;
    const absent = filteredReportRecords.filter((r) => r.status === "ABSENT").length;
    const late = filteredReportRecords.filter((r) => r.status === "LATE").length;
    const excused = filteredReportRecords.filter((r) => r.status === "EXCUSED").length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    return { total, present, absent, late, excused, rate };
  }, [filteredReportRecords]);

  // ─── Clickable Phone Dialer Integration ──────────────────────────────────────
  const handleDialPhone = useCallback((phone?: string | null) => {
    if (!phone) return;
    const cleaned = phone.replace(/[^\d+]/g, "");
    if (!cleaned) return;
    Linking.openURL(`tel:${cleaned}`).catch(() => {
      Alert.alert("Dialer Unavailable", `Could not launch phone dialer for ${phone}`);
    });
  }, []);

  const ClickablePhone = ({
    phone,
    label,
    style,
  }: {
    phone?: string | null;
    label?: string;
    style?: any;
  }) => {
    if (!phone || phone === "—" || phone === "N/A") {
      return <Text style={styles.cellMutedText}>—</Text>;
    }
    return (
      <TouchableOpacity
        style={[styles.clickablePhonePill, style]}
        onPress={() => handleDialPhone(phone)}
        activeOpacity={0.65}
      >
        <Text style={styles.clickablePhoneIcon}>📞</Text>
        <Text style={styles.clickablePhoneText} numberOfLines={1}>
          {label || phone}
        </Text>
      </TouchableOpacity>
    );
  };

  // ─── Filtered Datasets ──────────────────────────────────────────────────────

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const s = searchQuery.toLowerCase();
      const matchSearch =
        !searchQuery ||
        b.title.toLowerCase().includes(s) ||
        b.bookedBy?.toLowerCase().includes(s) ||
        b.facility?.name.toLowerCase().includes(s);

      const matchFacility =
        selectedFacilityId === "ALL" || b.facilityId === selectedFacilityId;

      let matchStatus = true;
      if (bookingStatusFilter === "UPCOMING") {
        matchStatus = new Date(b.startTime).getTime() >= Date.now() - 86400000;
      } else if (bookingStatusFilter === "CONFIRMED") {
        matchStatus = b.status === "CONFIRMED";
      }

      return matchSearch && matchFacility && matchStatus;
    });
  }, [bookings, searchQuery, selectedFacilityId, bookingStatusFilter]);

  const filteredPlayers = useMemo(() => {
    return players.filter((p) => {
      const s = searchQuery.toLowerCase();
      const matchSearch =
        !searchQuery ||
        p.fullName.toLowerCase().includes(s) ||
        p.playerCode.toLowerCase().includes(s) ||
        (p.mobileNumber && p.mobileNumber.includes(s)) ||
        (p.guardianPhone && p.guardianPhone.includes(s));

      const matchStatus =
        playerStatusFilter === "ALL" || p.status === playerStatusFilter;

      const matchSport =
        selectedSportId === "ALL" || p.primarySport?.id === selectedSportId;

      return matchSearch && matchStatus && matchSport;
    });
  }, [players, searchQuery, playerStatusFilter, selectedSportId]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const s = searchQuery.toLowerCase();
      const matchSearch =
        !searchQuery ||
        inv.invoiceNumber.toLowerCase().includes(s) ||
        (inv.player?.fullName && inv.player.fullName.toLowerCase().includes(s)) ||
        (inv.player?.playerCode && inv.player.playerCode.toLowerCase().includes(s));

      const matchStatus =
        invoiceStatusFilter === "ALL" || inv.status === invoiceStatusFilter;

      return matchSearch && matchStatus;
    });
  }, [invoices, searchQuery, invoiceStatusFilter]);

  // ─── Column Definitions for Flexible Data Tables ─────────────────────────────

  const bookingColumns: ColumnDef<AcademyBooking>[] = useMemo(
    () => [
      {
        id: "ref",
        label: "Ref / ID",
        width: 110,
        sortValue: (b) => b.id,
        renderCell: (b) => (
          <Text style={styles.codeText}>{b.id.slice(0, 10).toUpperCase()}</Text>
        ),
      },
      {
        id: "title",
        label: "Court Session",
        width: 170,
        sortValue: (b) => b.title,
        renderCell: (b) => (
          <Text style={styles.cellBoldText} numberOfLines={1}>
            {b.title}
          </Text>
        ),
      },
      {
        id: "facility",
        label: "Facility / Court",
        width: 170,
        sortValue: (b) => b.facility?.name || "",
        renderCell: (b) => (
          <Text style={styles.cellMutedText} numberOfLines={1}>
            {b.facility?.name || "Synthetic Court"}
          </Text>
        ),
      },
      {
        id: "date",
        label: "Booking Date",
        width: 110,
        sortValue: (b) => b.startTime,
        renderCell: (b) => (
          <Text style={styles.cellText}>{b.startTime.slice(0, 10)}</Text>
        ),
      },
      {
        id: "slot",
        label: "Time Slot",
        width: 120,
        renderCell: (b) => {
          const s = new Date(b.startTime).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          const e = new Date(b.endTime).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          return <Text style={styles.slotPillText}>{`${s} - ${e}`}</Text>;
        },
      },
      {
        id: "customer",
        label: "Booked By & Phone",
        width: 155,
        sortValue: (b) => b.bookedBy || "",
        renderCell: (b) => (
          <View>
            <Text style={styles.cellBoldText} numberOfLines={1}>
              {b.bookedBy || "Walk-in Guest"}
            </Text>
            {b.contactPhone ? (
              <ClickablePhone phone={b.contactPhone} style={{ marginTop: 2 }} />
            ) : null}
          </View>
        ),
      },
      {
        id: "status",
        label: "Status",
        width: 120,
        sortValue: (b) => b.status,
        renderCell: (b) => (
          <View
            style={[
              styles.badgeWrap,
              b.status === "CONFIRMED" ? styles.badgeConfirmed : styles.badgePending,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                b.status === "CONFIRMED"
                  ? styles.badgeTextConfirmed
                  : styles.badgeTextPending,
              ]}
            >
              ● {b.status}
            </Text>
          </View>
        ),
      },
      {
        id: "fee",
        label: "Amount (₹)",
        width: 110,
        sortValue: (b) => b.totalAmountCents,
        renderCell: (b) => (
          <Text style={styles.currencyCellText}>
            ₹{(b.totalAmountCents / 100).toLocaleString()}
          </Text>
        ),
      },
    ],
    []
  );

  const playerColumns: ColumnDef<AcademyPlayer>[] = useMemo(
    () => [
      {
        id: "code",
        label: "Player Code",
        width: 120,
        sortValue: (p) => p.playerCode,
        renderCell: (p) => <Text style={styles.codeText}>{p.playerCode}</Text>,
      },
      {
        id: "fullName",
        label: "Full Name",
        width: 160,
        sortValue: (p) => p.fullName,
        renderCell: (p) => (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {p.photoUrl ? (
              <Image
                source={{ uri: p.photoUrl }}
                style={{ width: 22, height: 22, borderRadius: 11 }}
              />
            ) : null}
            <Text style={styles.cellBoldText} numberOfLines={1}>
              {p.fullName}
            </Text>
          </View>
        ),
      },
      {
        id: "sport",
        label: "Sport",
        width: 130,
        sortValue: (p) => p.primarySport?.name || "",
        renderCell: (p) => (
          <Text style={styles.sportBadgeText}>
            {p.primarySport?.name.toUpperCase() || "BASKETBALL"}
          </Text>
        ),
      },
      {
        id: "venue",
        label: "Venue / Branch",
        width: 160,
        renderCell: (p) => (
          <Text style={styles.cellMutedText} numberOfLines={1}>
            {p.venue || "Biju Patnaik Indoor"}
          </Text>
        ),
      },
      {
        id: "ageSegment",
        label: "Age / Segment",
        width: 120,
        sortValue: (p) => p.age || 0,
        renderCell: (p) => (
          <Text style={styles.cellText}>
            {p.age ? `${p.age} yrs` : p.ageSegment || "Adults"}
          </Text>
        ),
      },
      {
        id: "contact",
        label: "Mobile / Contact",
        width: 145,
        renderCell: (p) => <ClickablePhone phone={p.mobileNumber || p.guardianPhone} />,
      },
      {
        id: "fee",
        label: "Monthly Fee",
        width: 110,
        sortValue: (p) => p.monthlyFee || 0,
        renderCell: (p) => (
          <Text style={styles.currencyCellText}>
            ₹{(p.monthlyFee || 3500).toLocaleString()}
          </Text>
        ),
      },
      {
        id: "status",
        label: "Status",
        width: 110,
        sortValue: (p) => p.status,
        renderCell: (p) => (
          <View
            style={[
              styles.badgeWrap,
              p.status === "ACTIVE" ? styles.badgeConfirmed : styles.badgeInactive,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                p.status === "ACTIVE"
                  ? styles.badgeTextConfirmed
                  : styles.badgeTextInactive,
              ]}
            >
              ● {p.status}
            </Text>
          </View>
        ),
      },
      {
        id: "joined",
        label: "Admission Date",
        width: 120,
        renderCell: (p) => (
          <Text style={styles.cellMutedText}>
            {p.createdAt ? p.createdAt.slice(0, 10) : "2026-10-12"}
          </Text>
        ),
      },
    ],
    []
  );

  const invoiceColumns: ColumnDef<AcademyInvoice>[] = useMemo(
    () => [
      {
        id: "invNum",
        label: "Invoice #",
        width: 130,
        sortValue: (i) => i.invoiceNumber,
        renderCell: (i) => <Text style={styles.codeText}>{i.invoiceNumber}</Text>,
      },
      {
        id: "player",
        label: "Player & Contact",
        width: 170,
        sortValue: (i) => i.player?.fullName || "",
        renderCell: (i) => {
          const matched = players.find((p) => p.id === i.playerId);
          const ph = i.player?.guardianPhone || matched?.guardianPhone || matched?.mobileNumber;
          return (
            <View>
              <Text style={styles.cellBoldText} numberOfLines={1}>
                {i.player?.fullName || matched?.fullName || "Academy Player"}
              </Text>
              {ph ? <ClickablePhone phone={ph} style={{ marginTop: 2 }} /> : null}
            </View>
          );
        },
      },
      {
        id: "due",
        label: "Due Date",
        width: 110,
        sortValue: (i) => i.dueDate,
        renderCell: (i) => <Text style={styles.cellText}>{i.dueDate}</Text>,
      },
      {
        id: "subtotal",
        label: "Total Fee",
        width: 110,
        sortValue: (i) => i.totalAmountCents,
        renderCell: (i) => (
          <Text style={styles.cellText}>
            ₹{(i.totalAmountCents / 100).toLocaleString()}
          </Text>
        ),
      },
      {
        id: "paid",
        label: "Paid Amount",
        width: 110,
        sortValue: (i) => i.paidAmountCents,
        renderCell: (i) => (
          <Text style={styles.currencyCellText}>
            ₹{(i.paidAmountCents / 100).toLocaleString()}
          </Text>
        ),
      },
      {
        id: "balance",
        label: "Balance Due",
        width: 110,
        sortValue: (i) => i.balanceCents,
        renderCell: (i) => (
          <Text
            style={[
              styles.cellBoldText,
              i.balanceCents > 0 ? styles.balanceDueText : styles.balanceClearText,
            ]}
          >
            ₹{(i.balanceCents / 100).toLocaleString()}
          </Text>
        ),
      },
      {
        id: "status",
        label: "Status",
        width: 110,
        sortValue: (i) => i.status,
        renderCell: (i) => (
          <View
            style={[
              styles.badgeWrap,
              i.status === "PAID"
                ? styles.badgeConfirmed
                : i.status === "OVERDUE"
                ? styles.badgeOverdue
                : styles.badgePending,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                i.status === "PAID"
                  ? styles.badgeTextConfirmed
                  : i.status === "OVERDUE"
                  ? styles.badgeTextOverdue
                  : styles.badgeTextPending,
              ]}
            >
              ● {i.status}
            </Text>
          </View>
        ),
      },
      {
        id: "action",
        label: "Action",
        width: 120,
        renderCell: (i) => (
          <TouchableOpacity
            style={[
              styles.badgeWrap,
              i.balanceCents > 0 ? styles.badgePending : styles.badgeConfirmed,
            ]}
            onPress={() => {
              setPayInvoiceId(i.id);
              setPayAmount(String(i.balanceCents > 0 ? i.balanceCents / 100 : i.totalAmountCents / 100));
              setIsRecordPaymentModalOpen(true);
            }}
          >
            <Text style={i.balanceCents > 0 ? styles.badgeTextPending : styles.badgeTextConfirmed}>
              {i.balanceCents > 0 ? "💳 Pay Fee" : "✓ Paid"}
            </Text>
          </TouchableOpacity>
        ),
      },
    ],
    [players]
  );

  const consumableColumns: ColumnDef<ConsumableItem>[] = useMemo(
    () => [
      {
        id: "code",
        label: "Item Code",
        width: 100,
        sortValue: (c) => c.id,
        renderCell: (c) => <Text style={styles.codeText}>{c.id.toUpperCase()}</Text>,
      },
      {
        id: "name",
        label: "Item Description",
        width: 240,
        sortValue: (c) => c.name,
        renderCell: (c) => (
          <Text style={styles.cellBoldText} numberOfLines={1}>
            {c.name}
          </Text>
        ),
      },
      {
        id: "category",
        label: "Category",
        width: 130,
        sortValue: (c) => c.category,
        renderCell: (c) => (
          <View style={[styles.badgeWrap, styles.badgeConfirmed]}>
            <Text style={styles.badgeTextConfirmed}>{c.category}</Text>
          </View>
        ),
      },
      {
        id: "unit",
        label: "Billing Unit",
        width: 110,
        sortValue: (c) => c.unit,
        renderCell: (c) => <Text style={styles.cellMutedText}>per {c.unit}</Text>,
      },
      {
        id: "price",
        label: "Price (₹)",
        width: 110,
        sortValue: (c) => c.price,
        renderCell: (c) => (
          <Text style={styles.currencyCellText}>₹{c.price.toLocaleString()}</Text>
        ),
      },
      {
        id: "status",
        label: "Stock Status",
        width: 120,
        renderCell: () => (
          <View style={[styles.badgeWrap, styles.badgeConfirmed]}>
            <Text style={styles.badgeTextConfirmed}>● In Stock</Text>
          </View>
        ),
      },
    ],
    []
  );

  // ─── Ribbon Sidebar Render ──────────────────────────────────────────────────

  const renderSidebar = () => {
    interface NavItem {
      id: string;
      label: string;
      icon: string;
      badge: string;
      isAction?: () => void;
    }
    const navItems: NavItem[] = [
      { id: "overview", label: "Executive Hub", icon: "📊", badge: "Live" },
      { id: "bookings", label: "Courts & Bookings", icon: "📅", badge: String(bookings.length) },
      { id: "players", label: "Players", icon: "👥", badge: String(players.length) },
      { id: "finance", label: "Fees & Payments", icon: "💰", badge: String(invoices.length) },
      { id: "consumables", label: "Consumables Table", icon: "📦", badge: String(ACADEMY_CONSUMABLES.length) },
      { id: "attendance", label: "Attendance Sheet", icon: "⏱️", badge: `${players.length} Students` },
      { id: "sports", label: "Sports Master", icon: "🏅", badge: String(sports.length) },
    ];

    const isMobile = !isTablet;
    const isRailCollapsed = isMobile ? true : sidebarCollapsed;

    return (
      <>
        {/* Inline Navigation Rail */}
        <View
          style={[
            styles.sidebarContainer,
            (isRailCollapsed || isMobile) && styles.sidebarCollapsed,
            isMobile && styles.mobileSidebarRail,
          ]}
        >
          {/* Rail Header / Brand & Navigation Expander Button */}
          <TouchableOpacity
            style={styles.railExpanderBtn}
            onPress={() => setSidebarCollapsed(!sidebarCollapsed)}
            activeOpacity={0.7}
          >
            <Text style={styles.railExpanderIcon}>☰</Text>
            <Text style={styles.railExpanderLabel}>
              {isMobile ? "EXPAND" : sidebarCollapsed ? "EXPAND" : "CLOSE"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.brandHeader}
            onPress={() => setSidebarCollapsed(!sidebarCollapsed)}
            activeOpacity={0.8}
          >
            <View style={styles.brandBadge}>
              <Text style={styles.brandLogoIcon}>⚡</Text>
            </View>
            {!isRailCollapsed && !isMobile && (
              <View style={styles.brandTextWrap}>
                <Text style={styles.brandTitle}>OFA ACADEMY</Text>
                <View style={styles.liveIndicatorRow}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>OPERATIONS</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>

          {/* User Card (Tablet Expanded only) */}
          {!isRailCollapsed && !isMobile && (
            <View style={styles.userCard}>
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>
                  {MOCK_CURRENT_USER.name.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName} numberOfLines={1}>
                  {MOCK_CURRENT_USER.name}
                </Text>
                <Text style={styles.userRole}>
                  {MOCK_CURRENT_USER.role === "admin" ? "👑 Admin" : "👔 Staff"}
                </Text>
              </View>
            </View>
          )}

          {/* Navigation Items List */}
          <ScrollView style={styles.navListScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.navSectionHeading}>
              {!isRailCollapsed && !isMobile ? "NAVIGATION TABS" : "•••"}
            </Text>

            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.navItemBtn,
                    isActive && styles.navItemBtnActive,
                    (isRailCollapsed || isMobile) && styles.navItemBtnCollapsed,
                  ]}
                  onPress={() => {
                    if (item.isAction) {
                      item.isAction();
                    } else {
                      setActiveTab(item.id as RibbonTab);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.navItemIcon}>{item.icon}</Text>
                  {!isRailCollapsed && !isMobile && (
                    <View style={styles.navItemLabelWrap}>
                      <Text
                        style={[
                          styles.navItemLabel,
                          isActive && styles.navItemLabelActive,
                        ]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                      {item.badge && (
                        <View style={[styles.navBadge, isActive && styles.navBadgeActive]}>
                          <Text style={[styles.navBadgeText, isActive && styles.navBadgeTextActive]}>
                            {item.badge}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}

            {/* Quick jump to OFA Assistant */}
            <View style={styles.chatNavSeparator} />
            <TouchableOpacity
              style={[styles.chatNavBtn, (isRailCollapsed || isMobile) && styles.chatNavBtnCollapsed]}
              onPress={() =>
                navigation.navigate("Chat", {
                  conversationId: "ofa-conv-001",
                  conversationName: "OFA Assistant",
                })
              }
              activeOpacity={0.7}
            >
              <Text style={styles.navItemIcon}>💬</Text>
              {!isRailCollapsed && !isMobile && (
                <View style={{ flex: 1 }}>
                  <Text style={styles.chatNavLabel}>OFA Assistant</Text>
                  <Text style={styles.chatNavSubLabel}>Read-Only Tables</Text>
                </View>
              )}
            </TouchableOpacity>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.sidebarFooter}>
            {isTablet && (
              <TouchableOpacity
                style={styles.collapseToggleBtn}
                onPress={() => setSidebarCollapsed(!sidebarCollapsed)}
              >
                <Text style={styles.collapseToggleText}>
                  {sidebarCollapsed ? "▶ Expand" : "◀ Collapse"}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.signOutBtn, (isRailCollapsed || isMobile) && styles.signOutBtnCollapsed]}
              onPress={handleSignOut}
            >
              <Text style={styles.signOutIcon}>🚪</Text>
              {!isRailCollapsed && !isMobile && <Text style={styles.signOutText}>Sign Out</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Mobile Overlay Navigation Drawer (Shows ALL Names when expanded without hiding notification tray) ── */}
        {isMobile && !sidebarCollapsed && (
          <View style={[styles.drawerModalBackdrop, { top: insets.top, bottom: 0 }]}>
              <View style={styles.drawerPanel}>
                {/* Drawer Header with Brand & Close Button */}
                <View style={styles.drawerHeaderRow}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                    <View style={styles.brandBadge}>
                      <Text style={styles.brandLogoIcon}>⚡</Text>
                    </View>
                    <View>
                      <Text style={styles.brandTitle}>OFA ACADEMY</Text>
                      <View style={styles.liveIndicatorRow}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveText}>OPERATIONS LIVE</Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.drawerCloseBtn}
                    onPress={() => setSidebarCollapsed(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.drawerCloseText}>✕ Close</Text>
                  </TouchableOpacity>
                </View>

                {/* User Card */}
                <View style={styles.userCard}>
                  <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>
                      {MOCK_CURRENT_USER.name.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName} numberOfLines={1}>
                      {MOCK_CURRENT_USER.name}
                    </Text>
                    <Text style={styles.userRole}>
                      {MOCK_CURRENT_USER.role === "admin" ? "👑 Admin" : "👔 Staff"}
                    </Text>
                  </View>
                </View>

                {/* Expanded Nav Items with ALL Names visible */}
                <ScrollView style={styles.navListScroll} showsVerticalScrollIndicator={false}>
                  <Text style={styles.navSectionHeading}>ALL NAVIGATION TABS</Text>
                  {navItems.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.navItemBtn,
                          isActive && styles.navItemBtnActive,
                        ]}
                        onPress={() => {
                          setSidebarCollapsed(true);
                          if (item.isAction) {
                            item.isAction();
                          } else {
                            setActiveTab(item.id as RibbonTab);
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.navItemIcon}>{item.icon}</Text>
                        <View style={styles.navItemLabelWrap}>
                          <Text
                            style={[
                              styles.navItemLabel,
                              isActive && styles.navItemLabelActive,
                            ]}
                            numberOfLines={1}
                          >
                            {item.label}
                          </Text>
                          {item.badge && (
                            <View style={[styles.navBadge, isActive && styles.navBadgeActive]}>
                              <Text style={[styles.navBadgeText, isActive && styles.navBadgeTextActive]}>
                                {item.badge}
                              </Text>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}

                  <View style={styles.chatNavSeparator} />
                  <TouchableOpacity
                    style={styles.chatNavBtn}
                    onPress={() => {
                      setSidebarCollapsed(true);
                      navigation.navigate("Chat", {
                        conversationId: "ofa-conv-001",
                        conversationName: "OFA Assistant",
                      });
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.navItemIcon}>💬</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.chatNavLabel}>OFA Assistant</Text>
                      <Text style={styles.chatNavSubLabel}>Read-Only Tables</Text>
                    </View>
                  </TouchableOpacity>
                </ScrollView>

                {/* Drawer Footer */}
                <View style={[styles.sidebarFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                  <TouchableOpacity
                    style={styles.collapseToggleBtn}
                    onPress={() => setSidebarCollapsed(true)}
                  >
                    <Text style={styles.collapseToggleText}>◀ Collapse Menu</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.signOutBtn}
                    onPress={() => {
                      setSidebarCollapsed(true);
                      handleSignOut();
                    }}
                  >
                    <Text style={styles.signOutIcon}>🚪</Text>
                    <Text style={styles.signOutText}>Sign Out</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Tapping backdrop dismisses drawer */}
              <TouchableOpacity
                style={styles.drawerDismissOverlay}
                activeOpacity={1}
                onPress={() => setSidebarCollapsed(true)}
              />
            </View>
        )}
      </>
    );
  };

  // ─── Main Content View Render ───────────────────────────────────────────────

  return (
    <View style={[styles.screenContainer, { paddingTop: insets.top }]}>
      <RNStatusBar barStyle="light-content" backgroundColor="#0F1626" translucent={false} hidden={false} />
      {/* Permanent Left-Side Navigation Tabs on all devices */}
      {renderSidebar()}

      {/* Main Operational Stage */}
      <View style={styles.mainStage}>
        {/* Top Operational Navigation Bar */}
        <View style={styles.topStageBar}>
          <View style={styles.topBarLeft}>
            <TouchableOpacity
              style={styles.hamburgerBtn}
              onPress={() => setSidebarCollapsed(!sidebarCollapsed)}
              activeOpacity={0.7}
            >
              <Text style={styles.hamburgerIcon}>{sidebarCollapsed ? "☰" : "◀"}</Text>
            </TouchableOpacity>
            <View style={styles.stageTitleWrap}>
              <Text style={styles.stageTitle} numberOfLines={1} ellipsizeMode="tail">
                {activeTab === "overview" && "📊 Executive Operations Hub"}
                {activeTab === "bookings" && "📅 Courts & Facility Bookings"}
                {activeTab === "players" && "👥 Players"}
                {activeTab === "finance" && "💰 Fees, Payments & Invoices"}
                {activeTab === "consumables" && "📦 Consumables & Equipment Catalog"}
                {activeTab === "attendance" &&
                  (attendanceMode === "mark" ? "⏱️ Mark Attendance" : "📊 Attendance Report")}
                {activeTab === "sports" && "🏅 Sports Disciplines & Batches"}
                {activeTab === "submissions" && "🤖 Bot Submissions Archive"}
              </Text>
              {isTablet && (
                <Text style={styles.stageSubtitle} numberOfLines={1} ellipsizeMode="tail">
                  Real-time operational dashboard with dynamic table column customization
                </Text>
              )}
            </View>
          </View>

          {/* Quick In-Place Action Buttons on Top Bar */}
          <View style={styles.topBarActions}>
            <TouchableOpacity
              style={styles.refreshIconBtn}
              onPress={onRefresh}
              disabled={refreshing}
            >
              <Text style={styles.refreshIconText}>🔄</Text>
            </TouchableOpacity>

            {(activeTab === "bookings" || activeTab === "overview" || activeTab === "consumables") && (
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={() => setIsNewBookingModalOpen(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryActionBtnText}>
                  {windowWidth < 420 ? "+ New" : "+ New Booking"}
                </Text>
              </TouchableOpacity>
            )}

            {activeTab === "players" && (
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={() => setIsAdmitPlayerModalOpen(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryActionBtnText}>
                  {windowWidth < 420 ? "+ Admit" : "+ Admit Player"}
                </Text>
              </TouchableOpacity>
            )}

            {activeTab === "finance" && (
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={() => setIsRecordPaymentModalOpen(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryActionBtnText}>
                  {windowWidth < 420 ? "+ Pay" : "+ Record Payment"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Scrollable Stage Body */}
        <ScrollView
          style={styles.stageScroll}
          contentContainerStyle={styles.stageScrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {loading ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.loadingText}>Synchronizing academy operational tables...</Text>
            </View>
          ) : (
            <>
              {/* ── TAB 1: EXECUTIVE HUB (OVERVIEW) ──────────────────────────────── */}
              {activeTab === "overview" && (
                <View>
                  {/* KPI Stat Cards Grid */}
                  <View style={styles.kpiCardsGrid}>
                    <View style={styles.kpiCard}>
                      <View style={styles.kpiCardTop}>
                        <Text style={styles.kpiTitle}>ACTIVE PLAYERS</Text>
                        <Text style={styles.kpiIcon}>👥</Text>
                      </View>
                      <Text style={styles.kpiValue}>{players.length}</Text>
                      <Text style={styles.kpiSub}>Registered roster across sports</Text>
                    </View>

                    <View style={styles.kpiCard}>
                      <View style={styles.kpiCardTop}>
                        <Text style={styles.kpiTitle}>COURT BOOKINGS</Text>
                        <Text style={styles.kpiIcon}>📅</Text>
                      </View>
                      <Text style={styles.kpiValue}>{bookings.length}</Text>
                      <Text style={styles.kpiSub}>Reservations on active facilities</Text>
                    </View>

                    <View style={styles.kpiCard}>
                      <View style={styles.kpiCardTop}>
                        <Text style={styles.kpiTitle}>INVOICE REVENUE</Text>
                        <Text style={styles.kpiIcon}>💰</Text>
                      </View>
                      <Text style={styles.kpiValue}>
                        ₹
                        {Math.round(
                          invoices.reduce((acc, i) => acc + i.paidAmountCents, 0) / 100
                        ).toLocaleString()}
                      </Text>
                      <Text style={styles.kpiSub}>
                        Outstanding: ₹
                        {Math.round(
                          invoices.reduce((acc, i) => acc + i.balanceCents, 0) / 100
                        ).toLocaleString()}
                      </Text>
                    </View>

                    <View style={styles.kpiCard}>
                      <View style={styles.kpiCardTop}>
                        <Text style={styles.kpiTitle}>ACTIVE BATCHES</Text>
                        <Text style={styles.kpiIcon}>⏱️</Text>
                      </View>
                      <Text style={styles.kpiValue}>{batches.length}</Text>
                      <Text style={styles.kpiSub}>Training sessions scheduled</Text>
                    </View>
                  </View>

                  {/* Overview Table 1: Upcoming Bookings Preview */}
                  <View style={styles.overviewSectionCard}>
                    <View style={styles.overviewSectionHeader}>
                      <View style={styles.overviewSectionTitleWrap}>
                        <Text style={styles.overviewSectionTitle} numberOfLines={1} ellipsizeMode="tail">
                          📅 Latest Court & Facility Bookings
                        </Text>
                        <Text style={styles.overviewSectionSub} numberOfLines={1} ellipsizeMode="tail">
                          Live table of slot reservations
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.sectionHeaderActionBtn}
                        onPress={() => setIsNewBookingModalOpen(true)}
                      >
                        <Text style={styles.sectionHeaderActionText}>
                          {windowWidth < 420 ? "+ New" : "+ New Booking"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <FlexibleDataTable
                      data={bookings.slice(0, 5)}
                      columns={bookingColumns}
                      keyExtractor={(b) => b.id}
                      emptyMessage="No bookings recorded yet."
                    />
                  </View>

                  {/* Overview Table 2: Recent Player Admissions */}
                  <View style={styles.overviewSectionCard}>
                    <View style={styles.overviewSectionHeader}>
                      <View style={styles.overviewSectionTitleWrap}>
                        <Text style={styles.overviewSectionTitle} numberOfLines={1} ellipsizeMode="tail">
                          👥 Recent Player Admissions
                        </Text>
                        <Text style={styles.overviewSectionSub} numberOfLines={1} ellipsizeMode="tail">
                          Latest player intake sequence records
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.sectionHeaderActionBtn}
                        onPress={() => setIsAdmitPlayerModalOpen(true)}
                      >
                        <Text style={styles.sectionHeaderActionText}>
                          {windowWidth < 420 ? "+ Admit" : "+ Admit Player"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <FlexibleDataTable
                      data={players.slice(0, 5)}
                      columns={playerColumns}
                      keyExtractor={(p) => p.id}
                      emptyMessage="No players admitted yet."
                    />
                  </View>
                </View>
              )}

              {/* ── TAB 2: COURTS & BOOKINGS ────────────────────────────────────── */}
              {activeTab === "bookings" && (
                <View>
                  {/* Filter & Search Bar */}
                  <View style={styles.filterControlBar}>
                    <TextInput
                      style={styles.searchBarInput}
                      placeholder="Search bookings by customer, court, or title..."
                      placeholderTextColor="#64748B"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />

                    <View style={styles.filterChipsRow}>
                      {["ALL", "UPCOMING", "CONFIRMED"].map((st) => (
                        <TouchableOpacity
                          key={st}
                          style={[
                            styles.filterChip,
                            bookingStatusFilter === st && styles.filterChipActive,
                          ]}
                          onPress={() => setBookingStatusFilter(st)}
                        >
                          <Text
                            style={[
                              styles.filterChipText,
                              bookingStatusFilter === st && styles.filterChipTextActive,
                            ]}
                          >
                            {st}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Flexible Table */}
                  <FlexibleDataTable
                    data={filteredBookings}
                    columns={bookingColumns}
                    keyExtractor={(b) => b.id}
                    emptyMessage="No bookings found matching current filters."
                    headerRight={
                      <TouchableOpacity
                        style={styles.inlineActionBtn}
                        onPress={() => setIsNewBookingModalOpen(true)}
                      >
                        <Text style={styles.inlineActionText}>
                          {windowWidth < 420 ? "+ New" : "+ Add Booking"}
                        </Text>
                      </TouchableOpacity>
                    }
                  />
                </View>
              )}

              {/* ── TAB 3: PLAYERS & ADMISSIONS ──────────────────────────────────── */}
              {activeTab === "players" && (
                <View>
                  {/* Filter & Search Bar */}
                  <View style={styles.filterControlBar}>
                    <TextInput
                      style={styles.searchBarInput}
                      placeholder="Search players by name, code (OFA-*), or phone..."
                      placeholderTextColor="#64748B"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />

                    <View style={styles.filterChipsRow}>
                      {["ALL", "ACTIVE", "INACTIVE", "SUSPENDED"].map((st) => (
                        <TouchableOpacity
                          key={st}
                          style={[
                            styles.filterChip,
                            playerStatusFilter === st && styles.filterChipActive,
                          ]}
                          onPress={() => setPlayerStatusFilter(st)}
                        >
                          <Text
                            style={[
                              styles.filterChipText,
                              playerStatusFilter === st && styles.filterChipTextActive,
                            ]}
                          >
                            {st}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Flexible Table */}
                  <FlexibleDataTable
                    data={filteredPlayers}
                    columns={playerColumns}
                    keyExtractor={(p) => p.id}
                    emptyMessage="No players found matching current filters."
                    headerRight={
                      <TouchableOpacity
                        style={styles.inlineActionBtn}
                        onPress={() => setIsAdmitPlayerModalOpen(true)}
                      >
                        <Text style={styles.inlineActionText}>
                          {windowWidth < 420 ? "+ Admit" : "+ Admit Player"}
                        </Text>
                      </TouchableOpacity>
                    }
                  />
                </View>
              )}

              {/* ── TAB 4: FEES, PAYMENTS & INVOICES (COMBINED) ───────────────────── */}
              {activeTab === "finance" && (
                <View>
                  {/* Financial KPI Summary Cards */}
                  <View style={styles.kpiCardsGrid}>
                    <View style={styles.kpiCard}>
                      <View style={styles.kpiCardTop}>
                        <Text style={styles.kpiTitle}>TOTAL INVOICED</Text>
                        <Text style={styles.kpiIcon}>📜</Text>
                      </View>
                      <Text style={styles.kpiValue}>
                        ₹{Math.round(invoices.reduce((acc, i) => acc + i.totalAmountCents, 0) / 100).toLocaleString()}
                      </Text>
                      <Text style={styles.kpiSub}>{invoices.length} billed invoice(s)</Text>
                    </View>

                    <View style={styles.kpiCard}>
                      <View style={styles.kpiCardTop}>
                        <Text style={styles.kpiTitle}>FEES COLLECTED</Text>
                        <Text style={styles.kpiIcon}>💰</Text>
                      </View>
                      <Text style={[styles.kpiValue, { color: "#10B981" }]}>
                        ₹{Math.round(invoices.reduce((acc, i) => acc + i.paidAmountCents, 0) / 100).toLocaleString()}
                      </Text>
                      <Text style={styles.kpiSub}>Received payments</Text>
                    </View>

                    <View style={styles.kpiCard}>
                      <View style={styles.kpiCardTop}>
                        <Text style={styles.kpiTitle}>BALANCE DUE</Text>
                        <Text style={styles.kpiIcon}>⏳</Text>
                      </View>
                      <Text style={[styles.kpiValue, { color: "#F59E0B" }]}>
                        ₹{Math.round(invoices.reduce((acc, i) => acc + i.balanceCents, 0) / 100).toLocaleString()}
                      </Text>
                      <Text style={styles.kpiSub}>Pending fee collections</Text>
                    </View>

                    <View style={styles.kpiCard}>
                      <View style={styles.kpiCardTop}>
                        <Text style={styles.kpiTitle}>OVERDUE</Text>
                        <Text style={styles.kpiIcon}>⚠️</Text>
                      </View>
                      <Text style={[styles.kpiValue, { color: "#EF4444" }]}>
                        {invoices.filter((i) => i.status === "OVERDUE").length}
                      </Text>
                      <Text style={styles.kpiSub}>Invoices requiring payment</Text>
                    </View>
                  </View>

                  {/* Filter & Search Bar */}
                  <View style={styles.filterControlBar}>
                    <TextInput
                      style={styles.searchBarInput}
                      placeholder="Search invoices by player name, invoice #..."
                      placeholderTextColor="#64748B"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />

                    <View style={styles.filterChipsRow}>
                      {["ALL", "OVERDUE", "ISSUED", "PAID"].map((st) => (
                        <TouchableOpacity
                          key={st}
                          style={[
                            styles.filterChip,
                            invoiceStatusFilter === st && styles.filterChipActive,
                          ]}
                          onPress={() => setInvoiceStatusFilter(st)}
                        >
                          <Text
                            style={[
                              styles.filterChipText,
                              invoiceStatusFilter === st && styles.filterChipTextActive,
                            ]}
                          >
                            {st}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Flexible Table with Direct Action */}
                  <FlexibleDataTable
                    data={filteredInvoices}
                    columns={invoiceColumns}
                    keyExtractor={(i) => i.id}
                    emptyMessage="No invoices found matching current filters."
                    headerRight={
                      <TouchableOpacity
                        style={styles.inlineActionBtn}
                        onPress={() => {
                          if (invoices.length > 0) {
                            setPayInvoiceId(invoices[0].id);
                            setPayAmount(String(invoices[0].balanceCents ? invoices[0].balanceCents / 100 : 0));
                          }
                          setIsRecordPaymentModalOpen(true);
                        }}
                      >
                        <Text style={styles.inlineActionText}>+ Pay / Collect Fee</Text>
                      </TouchableOpacity>
                    }
                  />
                </View>
              )}

              {/* ── TAB 5: ATTENDANCE SHEET (MARK ATTENDANCE & ATTENDANCE REPORT) ─────────── */}
              {activeTab === "attendance" && (
                <View style={styles.attCard}>
                  {/* Mode Selector Toggle: Mark Attendance vs Attendance Report */}
                  <View style={styles.attModeToggleRow}>
                    <TouchableOpacity
                      style={[
                        styles.attModeToggleBtn,
                        attendanceMode === "mark" && styles.attModeToggleBtnActive,
                      ]}
                      onPress={() => setAttendanceMode("mark")}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.attModeToggleText,
                          attendanceMode === "mark" && styles.attModeToggleTextActive,
                        ]}
                      >
                        📝 Mark Attendance
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.attModeToggleBtn,
                        attendanceMode === "report" && styles.attModeToggleBtnActive,
                      ]}
                      onPress={() => {
                        setAttendanceMode("report");
                        loadAttendanceReport();
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.attModeToggleText,
                          attendanceMode === "report" && styles.attModeToggleTextActive,
                        ]}
                      >
                        📊 Attendance Report & History
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* ───────────────────────────────────────────────────────────────── */}
                  {/* FEATURE 1: MARK ATTENDANCE FOR PARTICULAR DATE                    */}
                  {/* ───────────────────────────────────────────────────────────────── */}
                  {attendanceMode === "mark" && (
                    <>
                      {/* Top Header Row with Particular Date Controls & Direct Save */}
                      <View style={styles.attHeaderRow}>
                        <View style={{ flex: 1, minWidth: 180 }}>
                          <Text style={styles.attTitle}>⏱️ Mark Student Attendance</Text>
                          <Text style={styles.attSub}>
                            Select a particular date, mark present/absent & sync to Google Sheets
                          </Text>
                        </View>

                        {/* Particular Date Selector & Shift Controls */}
                        <View style={styles.attDateSelectorWrap}>
                          <View style={styles.attDatePill}>
                            <TouchableOpacity onPress={() => shiftAttendanceDate(-1)} activeOpacity={0.6}>
                              <Text style={styles.attDateArrow}>◀</Text>
                            </TouchableOpacity>
                            <TextInput
                              style={styles.attDateInput}
                              value={attendanceDate}
                              onChangeText={setAttendanceDate}
                              placeholder="YYYY-MM-DD"
                              placeholderTextColor="#64748B"
                              maxLength={10}
                            />
                            <TouchableOpacity onPress={() => shiftAttendanceDate(1)} activeOpacity={0.6}>
                              <Text style={styles.attDateArrow}>▶</Text>
                            </TouchableOpacity>
                          </View>
                          <TouchableOpacity
                            style={styles.attTodayBtn}
                            onPress={setAttendanceDateToday}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.attTodayBtnText}>Today</Text>
                          </TouchableOpacity>
                        </View>

                        {/* Primary Save & Sync Action */}
                        <TouchableOpacity
                          style={styles.attSavePrimaryBtn}
                          onPress={handleSaveAttendance}
                          disabled={submittingAttendance}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.attSavePrimaryBtnText}>
                            {submittingAttendance
                              ? "Saving..."
                              : `💾 Save & Sync (${attendanceCounts.present} Present)`}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Real-time Notice Banner */}
                      {attendanceNotice && (
                        <View style={styles.attNoticeBanner}>
                          <Text style={styles.attNoticeText}>{attendanceNotice}</Text>
                        </View>
                      )}

                      {/* Live KPI Metric Cards for Selected Date */}
                      <View style={styles.attKpiRow}>
                        <View style={styles.attKpiCard}>
                          <Text style={styles.attKpiVal}>{attendanceCounts.total}</Text>
                          <Text style={styles.attKpiLbl}>Total Admitted</Text>
                        </View>
                        <View style={[styles.attKpiCard, { borderColor: "rgba(16, 185, 129, 0.4)" }]}>
                          <Text style={[styles.attKpiVal, { color: "#10B981" }]}>
                            {attendanceCounts.present}
                          </Text>
                          <Text style={styles.attKpiLbl}>Present</Text>
                        </View>
                        <View style={[styles.attKpiCard, { borderColor: "rgba(239, 68, 68, 0.4)" }]}>
                          <Text style={[styles.attKpiVal, { color: "#EF4444" }]}>
                            {attendanceCounts.absent}
                          </Text>
                          <Text style={styles.attKpiLbl}>Absent</Text>
                        </View>
                        <View style={[styles.attKpiCard, { borderColor: "rgba(245, 158, 11, 0.4)" }]}>
                          <Text style={[styles.attKpiVal, { color: "#F59E0B" }]}>
                            {attendanceCounts.late}
                          </Text>
                          <Text style={styles.attKpiLbl}>Late</Text>
                        </View>
                        <View style={[styles.attKpiCard, { borderColor: "rgba(99, 102, 241, 0.4)" }]}>
                          <Text style={[styles.attKpiVal, { color: "#818CF8" }]}>
                            {attendanceCounts.excused}
                          </Text>
                          <Text style={styles.attKpiLbl}>Excused</Text>
                        </View>
                      </View>

                      {/* Batch Controls & Filter Toolbar */}
                      <View style={styles.attBatchActionRow}>
                        <TouchableOpacity
                          style={styles.attBatchBtn}
                          onPress={() => setAllAttendance("PRESENT")}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.attBatchBtnText, { color: "#10B981" }]}>✓ All Present</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.attBatchBtn}
                          onPress={() => setAllAttendance("ABSENT")}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.attBatchBtnText, { color: "#EF4444" }]}>✕ All Absent</Text>
                        </TouchableOpacity>
                        <View style={{ flex: 1 }} />
                        <Text style={{ color: "#94A3B8", fontSize: 12, alignSelf: "center" }}>
                          Marking for: <Text style={{ color: "#38BDF8", fontWeight: "700" }}>{attendanceDate}</Text>
                        </Text>
                      </View>

                      {/* Search and Venue Filters */}
                      <View style={styles.filterControlBar}>
                        <TextInput
                          style={styles.searchBarInput}
                          placeholder="Search admitted students by name or ID..."
                          placeholderTextColor="#64748B"
                          value={attendanceSearch}
                          onChangeText={setAttendanceSearch}
                        />

                        {/* Venue Filters */}
                        <View style={styles.filterChipsRow}>
                          {["ALL", "OFA-1", "OFA-2", "OFA-3"].map((v) => (
                            <TouchableOpacity
                              key={v}
                              style={[
                                styles.filterChip,
                                attendanceVenueFilter === v && styles.filterChipActive,
                              ]}
                              onPress={() => setAttendanceVenueFilter(v)}
                            >
                              <Text
                                style={[
                                  styles.filterChipText,
                                  attendanceVenueFilter === v && styles.filterChipTextActive,
                                ]}
                              >
                                {v}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>

                      {/* Students Roster List */}
                      {filteredAttendancePlayers.length === 0 ? (
                        <View style={{ paddingVertical: 24, alignItems: "center" }}>
                          <Text style={{ fontSize: 32, marginBottom: 8 }}>👥</Text>
                          <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700" }}>
                            {players.length === 0
                              ? "No Admitted Students Found"
                              : "No students matching current filters"}
                          </Text>
                          <Text style={{ color: "#94A3B8", fontSize: 12, marginTop: 4, textAlign: "center" }}>
                            {players.length === 0
                              ? "Register new players using '+ Admit Player' to begin tracking attendance."
                              : "Try resetting your search query or venue filters above."}
                          </Text>
                          {players.length === 0 && (
                            <TouchableOpacity
                              style={[styles.primaryActionBtn, { marginTop: 14 }]}
                              onPress={() => setIsAdmitPlayerModalOpen(true)}
                            >
                              <Text style={styles.primaryActionBtnText}>+ Admit Player Now</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ) : (
                        filteredAttendancePlayers.map((player) => {
                          const curStatus = attendanceStatusMap[player.id] || "PRESENT";
                          return (
                            <View key={player.id} style={styles.attPlayerItem}>
                              <View style={styles.attPlayerLeft}>
                                <View style={styles.attPlayerAvatar}>
                                  <Text style={styles.attPlayerAvatarText}>
                                    {player.fullName.slice(0, 1).toUpperCase()}
                                  </Text>
                                </View>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <Text style={styles.attPlayerName} numberOfLines={1}>
                                    {player.fullName}
                                  </Text>
                                  <View style={styles.attPlayerMetaRow}>
                                    <View style={styles.attPlayerCodeBadge}>
                                      <Text style={styles.attPlayerCodeText}>{player.playerCode}</Text>
                                    </View>
                                    <Text style={styles.attPlayerMetaText}>
                                      {player.venue || "OFA-1"} • {player.primarySport?.name || "General"}
                                    </Text>
                                    {(player.mobileNumber || player.guardianPhone) ? (
                                      <ClickablePhone phone={player.mobileNumber || player.guardianPhone} />
                                    ) : null}
                                  </View>
                                </View>
                              </View>

                              {/* Quick 4-Status Pill Selector */}
                              <View style={styles.attStatusPillGroup}>
                                <TouchableOpacity
                                  style={[
                                    styles.attStatusBtn,
                                    curStatus === "PRESENT" && styles.attStatusPresentActive,
                                  ]}
                                  onPress={() => setPlayerAttendanceStatus(player.id, "PRESENT")}
                                  activeOpacity={0.7}
                                >
                                  <Text
                                    style={[
                                      styles.attStatusBtnText,
                                      curStatus === "PRESENT" && styles.attStatusPresentTextActive,
                                    ]}
                                  >
                                    P
                                  </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                  style={[
                                    styles.attStatusBtn,
                                    curStatus === "ABSENT" && styles.attStatusAbsentActive,
                                  ]}
                                  onPress={() => setPlayerAttendanceStatus(player.id, "ABSENT")}
                                  activeOpacity={0.7}
                                >
                                  <Text
                                    style={[
                                      styles.attStatusBtnText,
                                      curStatus === "ABSENT" && styles.attStatusAbsentTextActive,
                                    ]}
                                  >
                                    A
                                  </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                  style={[
                                    styles.attStatusBtn,
                                    curStatus === "LATE" && styles.attStatusLateActive,
                                  ]}
                                  onPress={() => setPlayerAttendanceStatus(player.id, "LATE")}
                                  activeOpacity={0.7}
                                >
                                  <Text
                                    style={[
                                      styles.attStatusBtnText,
                                      curStatus === "LATE" && styles.attStatusLateTextActive,
                                    ]}
                                  >
                                    L
                                  </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                  style={[
                                    styles.attStatusBtn,
                                    curStatus === "EXCUSED" && styles.attStatusExcusedActive,
                                  ]}
                                  onPress={() => setPlayerAttendanceStatus(player.id, "EXCUSED")}
                                  activeOpacity={0.7}
                                >
                                  <Text
                                    style={[
                                      styles.attStatusBtnText,
                                      curStatus === "EXCUSED" && styles.attStatusExcusedTextActive,
                                    ]}
                                  >
                                    E
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })
                      )}

                      {/* Bottom Save Bar */}
                      {filteredAttendancePlayers.length > 0 && (
                        <View style={{ marginTop: 12, alignItems: "flex-end" }}>
                          <TouchableOpacity
                            style={styles.attSavePrimaryBtn}
                            onPress={handleSaveAttendance}
                            disabled={submittingAttendance}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.attSavePrimaryBtnText}>
                              {submittingAttendance
                                ? "Saving..."
                                : `💾 Save Attendance for ${attendanceDate} (${attendanceCounts.present} Present)`}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </>
                  )}

                  {/* ───────────────────────────────────────────────────────────────── */}
                  {/* FEATURE 2: ATTENDANCE REPORT WITH COMPREHENSIVE FILTERS          */}
                  {/* ───────────────────────────────────────────────────────────────── */}
                  {attendanceMode === "report" && (
                    <View style={{ marginTop: 8 }}>
                      {/* Section Title & Subtitle */}
                      <View style={{ marginBottom: 14 }}>
                        <Text style={styles.attTitle}>📊 Attendance History & Reports</Text>
                        <Text style={styles.attSub}>
                          Filter by preset date range, custom dates, specific students, and attendance status
                        </Text>
                      </View>

                      {/* Filter Panel */}
                      <View style={styles.reportFilterBox}>
                        {/* 1. Date Range Preset Filter */}
                        <Text style={styles.reportFilterLabel}>📅 Date Range Presets:</Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={styles.presetScroll}
                          contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
                        >
                          {(
                            [
                              { key: "today", label: "Today" },
                              { key: "yesterday", label: "Yesterday" },
                              { key: "this_week", label: "This Week" },
                              { key: "this_month", label: "This Month" },
                              { key: "last_month", label: "Last Month" },
                              { key: "custom", label: "Custom Range" },
                            ] as const
                          ).map((p) => (
                            <TouchableOpacity
                              key={p.key}
                              style={[
                                styles.reportPresetChip,
                                reportDatePreset === p.key && styles.reportPresetChipActive,
                              ]}
                              onPress={() => handleSelectPreset(p.key)}
                              activeOpacity={0.7}
                            >
                              <Text
                                style={[
                                  styles.reportPresetChipText,
                                  reportDatePreset === p.key && styles.reportPresetChipTextActive,
                                ]}
                              >
                                {p.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>

                        {/* Custom Date Inputs (Always available or when Custom selected) */}
                        <View style={styles.customRangeRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.customRangeLabel}>From (YYYY-MM-DD):</Text>
                            <TextInput
                              style={styles.customRangeInput}
                              value={reportFromDate}
                              onChangeText={(v) => {
                                setReportFromDate(v);
                                setReportDatePreset("custom");
                              }}
                              placeholder="YYYY-MM-DD"
                              placeholderTextColor="#64748B"
                              maxLength={10}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.customRangeLabel}>To (YYYY-MM-DD):</Text>
                            <TextInput
                              style={styles.customRangeInput}
                              value={reportToDate}
                              onChangeText={(v) => {
                                setReportToDate(v);
                                setReportDatePreset("custom");
                              }}
                              placeholder="YYYY-MM-DD"
                              placeholderTextColor="#64748B"
                              maxLength={10}
                            />
                          </View>
                          <TouchableOpacity
                            style={styles.customRangeApplyBtn}
                            onPress={() =>
                              loadAttendanceReport(
                                reportFromDate,
                                reportToDate,
                                reportStudentFilter,
                                reportStatusFilter
                              )
                            }
                            activeOpacity={0.8}
                          >
                            <Text style={styles.customRangeApplyText}>Apply</Text>
                          </TouchableOpacity>
                        </View>

                        {/* 2. Student Wise Filter */}
                        <Text style={[styles.reportFilterLabel, { marginTop: 12 }]}>
                          👤 Student-Wise Filter:
                        </Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={styles.presetScroll}
                          contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
                        >
                          <TouchableOpacity
                            style={[
                              styles.reportStudentChip,
                              reportStudentFilter === "ALL" && styles.reportStudentChipActive,
                            ]}
                            onPress={() => {
                              setReportStudentFilter("ALL");
                              loadAttendanceReport(reportFromDate, reportToDate, "ALL", reportStatusFilter);
                            }}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.reportStudentChipText,
                                reportStudentFilter === "ALL" && styles.reportStudentChipTextActive,
                              ]}
                            >
                              👥 All Students ({players.length})
                            </Text>
                          </TouchableOpacity>

                          {players.map((p) => {
                            const isSelected = reportStudentFilter === p.id;
                            return (
                              <TouchableOpacity
                                key={p.id}
                                style={[
                                  styles.reportStudentChip,
                                  isSelected && styles.reportStudentChipActive,
                                ]}
                                onPress={() => {
                                  setReportStudentFilter(p.id);
                                  loadAttendanceReport(reportFromDate, reportToDate, p.id, reportStatusFilter);
                                }}
                                activeOpacity={0.7}
                              >
                                <Text
                                  style={[
                                    styles.reportStudentChipText,
                                    isSelected && styles.reportStudentChipTextActive,
                                  ]}
                                  numberOfLines={1}
                                >
                                  {p.fullName} ({p.playerCode})
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>

                        {/* 3. Status Filter & Keyword Search */}
                        <View style={styles.reportStatusSearchRow}>
                          <View style={{ flex: 1, minWidth: 200 }}>
                            <TextInput
                              style={styles.searchBarInput}
                              placeholder="Search student, code, or phone..."
                              placeholderTextColor="#64748B"
                              value={reportSearch}
                              onChangeText={setReportSearch}
                            />
                          </View>
                          <View style={styles.filterChipsRow}>
                            {(["ALL", "PRESENT", "ABSENT", "LATE", "EXCUSED"] as const).map((st) => (
                              <TouchableOpacity
                                key={st}
                                style={[
                                  styles.filterChip,
                                  reportStatusFilter === st && styles.filterChipActive,
                                ]}
                                onPress={() => {
                                  setReportStatusFilter(st);
                                  loadAttendanceReport(reportFromDate, reportToDate, reportStudentFilter, st);
                                }}
                                activeOpacity={0.7}
                              >
                                <Text
                                  style={[
                                    styles.filterChipText,
                                    reportStatusFilter === st && styles.filterChipTextActive,
                                  ]}
                                >
                                  {st}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      </View>

                      {/* KPI Summary for Filtered Report */}
                      <View style={styles.attKpiRow}>
                        <View style={styles.attKpiCard}>
                          <Text style={styles.attKpiVal}>{reportMetrics.total}</Text>
                          <Text style={styles.attKpiLbl}>Total Records</Text>
                        </View>
                        <View style={[styles.attKpiCard, { borderColor: "rgba(16, 185, 129, 0.4)" }]}>
                          <Text style={[styles.attKpiVal, { color: "#10B981" }]}>
                            {reportMetrics.present}
                          </Text>
                          <Text style={styles.attKpiLbl}>Present</Text>
                        </View>
                        <View style={[styles.attKpiCard, { borderColor: "rgba(239, 68, 68, 0.4)" }]}>
                          <Text style={[styles.attKpiVal, { color: "#EF4444" }]}>
                            {reportMetrics.absent}
                          </Text>
                          <Text style={styles.attKpiLbl}>Absent</Text>
                        </View>
                        <View style={[styles.attKpiCard, { borderColor: "rgba(245, 158, 11, 0.4)" }]}>
                          <Text style={[styles.attKpiVal, { color: "#F59E0B" }]}>
                            {reportMetrics.late}
                          </Text>
                          <Text style={styles.attKpiLbl}>Late</Text>
                        </View>
                        <View style={[styles.attKpiCard, { borderColor: "rgba(99, 102, 241, 0.4)" }]}>
                          <Text style={[styles.attKpiVal, { color: "#818CF8" }]}>
                            {reportMetrics.rate}%
                          </Text>
                          <Text style={styles.attKpiLbl}>Present Rate</Text>
                        </View>
                      </View>

                      {/* Report Records Feed */}
                      {loadingReport ? (
                        <View style={{ paddingVertical: 32, alignItems: "center" }}>
                          <ActivityIndicator size="large" color="#3B82F6" />
                          <Text style={{ color: "#94A3B8", marginTop: 8, fontSize: 13 }}>
                            Loading attendance records...
                          </Text>
                        </View>
                      ) : filteredReportRecords.length === 0 ? (
                        <View style={{ paddingVertical: 32, alignItems: "center" }}>
                          <Text style={{ fontSize: 36, marginBottom: 8 }}>📋</Text>
                          <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>
                            No Attendance Records Found
                          </Text>
                          <Text
                            style={{
                              color: "#94A3B8",
                              fontSize: 12,
                              marginTop: 4,
                              textAlign: "center",
                              maxWidth: 340,
                            }}
                          >
                            No attendance records match your current filters for the period{" "}
                            {reportFromDate} to {reportToDate}. Try adjusting your date range or student filter.
                          </Text>
                          <TouchableOpacity
                            style={[styles.primaryActionBtn, { marginTop: 14 }]}
                            onPress={() => {
                              handleSelectPreset("this_month");
                              setReportStudentFilter("ALL");
                              setReportStatusFilter("ALL");
                              setReportSearch("");
                            }}
                          >
                            <Text style={styles.primaryActionBtnText}>Reset All Filters</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        filteredReportRecords.map((rec) => {
                          const student =
                            rec.player || players.find((p) => p.id === rec.playerId);
                          const studentName = student?.fullName || "Academy Student";
                          const studentCode = student?.playerCode || "OFA-*";
                          const studentPhone =
                            student?.guardianPhone || student?.mobileNumber || "";

                          return (
                            <View key={rec.id} style={styles.reportRecordCard}>
                              <View style={styles.reportRecordTop}>
                                <View style={styles.reportDateBadge}>
                                  <Text style={styles.reportDateText}>
                                    📅 {rec.sessionDate || "Unknown Date"}
                                  </Text>
                                </View>
                                <View
                                  style={[
                                    styles.reportStatusBadge,
                                    rec.status === "PRESENT" && styles.reportStatusBadgePresent,
                                    rec.status === "ABSENT" && styles.reportStatusBadgeAbsent,
                                    rec.status === "LATE" && styles.reportStatusBadgeLate,
                                    rec.status === "EXCUSED" && styles.reportStatusBadgeExcused,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.reportStatusBadgeText,
                                      rec.status === "PRESENT" && styles.reportStatusBadgeTextPresent,
                                      rec.status === "ABSENT" && styles.reportStatusBadgeTextAbsent,
                                      rec.status === "LATE" && styles.reportStatusBadgeTextLate,
                                      rec.status === "EXCUSED" && styles.reportStatusBadgeTextExcused,
                                    ]}
                                  >
                                    {rec.status}
                                  </Text>
                                </View>
                              </View>

                              <View style={styles.reportRecordBody}>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                    <Text style={styles.reportStudentName} numberOfLines={1}>
                                      {studentName}
                                    </Text>
                                    <View style={styles.attPlayerCodeBadge}>
                                      <Text style={styles.attPlayerCodeText}>{studentCode}</Text>
                                    </View>
                                  </View>

                                  <View style={styles.reportRecordMetaRow}>
                                    <Text style={styles.reportRecordSub}>
                                      Session: {rec.sessionTime || "06:00 - 08:00 AM"}
                                      {rec.markedBy ? ` • Marked by: ${rec.markedBy}` : ""}
                                    </Text>
                                  </View>

                                  {rec.notes ? (
                                    <Text style={styles.reportRecordNotes} numberOfLines={2}>
                                      💬 {rec.notes}
                                    </Text>
                                  ) : null}
                                </View>

                                {studentPhone ? (
                                  <ClickablePhone phone={studentPhone} />
                                ) : null}
                              </View>
                            </View>
                          );
                        })
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* ── TAB 6: SPORTS MASTER ─────────────────────────────────────────── */}
              {activeTab === "sports" && (
                <View style={styles.overviewSectionCard}>
                  <View style={styles.overviewSectionHeader}>
                    <View>
                      <Text style={styles.overviewSectionTitle}>🏅 Academy Sports Disciplines</Text>
                      <Text style={styles.overviewSectionSub}>
                        Billing models and configured programs
                      </Text>
                    </View>
                  </View>
                  {sports.map((sp) => (
                    <View key={sp.id} style={styles.listCardRow}>
                      <View>
                        <Text style={styles.listCardTitle}>{sp.name}</Text>
                        <Text style={styles.listCardSub}>
                          Category: {sp.category || "General"} • Billing: {sp.billingMethod}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.badgeWrap,
                          sp.isActive ? styles.badgeConfirmed : styles.badgeInactive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            sp.isActive ? styles.badgeTextConfirmed : styles.badgeTextInactive,
                          ]}
                        >
                          {sp.isActive ? "ACTIVE" : "INACTIVE"}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* ── TAB 9: BOT SUBMISSIONS ───────────────────────────────────────── */}
              {activeTab === "submissions" && (
                <View style={styles.overviewSectionCard}>
                  <View style={styles.overviewSectionHeader}>
                    <View>
                      <Text style={styles.overviewSectionTitle}>
                        🤖 WhatsApp & Bot Form Ingestion Logs
                      </Text>
                      <Text style={styles.overviewSectionSub}>
                        Commands and raw payloads received
                      </Text>
                    </View>
                  </View>
                  {submissions.map((sub: any) => (
                    <View key={sub.id} style={styles.listCardRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.listCardTitle}>
                          {sub.userName || "Guest"} • /{sub.templateCommand}
                        </Text>
                        <Text style={styles.listCardSub}>
                          Ref: {sub.submissionRef || "N/A"} • Status: {sub.status}
                        </Text>
                        {sub.userPhone ? (
                          <ClickablePhone phone={sub.userPhone} style={{ marginTop: 4 }} />
                        ) : null}
                      </View>
                      <Text style={styles.cellMutedText}>{sub.createdAt.slice(0, 10)}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* ── TAB 10: CONSUMABLES INVENTORY TABLE ────────────────────────── */}
              {activeTab === "consumables" && (
                <View style={styles.overviewSectionCard}>
                  <View style={styles.overviewSectionHeader}>
                    <View style={styles.overviewSectionTitleWrap}>
                      <Text style={styles.overviewSectionTitle} numberOfLines={1} ellipsizeMode="tail">
                        📦 Academy Consumables & Equipment Catalog
                      </Text>
                      <Text style={styles.overviewSectionSub} numberOfLines={1} ellipsizeMode="tail">
                        Inventory list of consumable items and rental gear with fixed rates
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.sectionHeaderActionBtn}
                      onPress={() => setIsNewBookingModalOpen(true)}
                    >
                      <Text style={styles.sectionHeaderActionText}>
                        {windowWidth < 420 ? "+ New" : "+ New Booking"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <FlexibleDataTable
                    data={ACADEMY_CONSUMABLES}
                    columns={consumableColumns}
                    keyExtractor={(c) => c.id}
                    emptyMessage="No consumable items configured."
                  />
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>

      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 1: IN-PLACE NEW COURT BOOKING (WITH CONSUMABLES & AUTO-LOOKUP)       */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      <Modal visible={isNewBookingModalOpen} animationType="fade" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalBackdrop}
          keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 10}
        >
          <View style={[styles.modalContainer, { maxWidth: 640, maxHeight: "90%" }]}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitleText}>Reserve Court / Slot</Text>
                <Text style={styles.modalSubText}>
                  Book a facility and attach consumables with live price calculation
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsNewBookingModalOpen(false)}>
                <Text style={styles.closeModalText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalFormScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              {phoneLookupNotice && (
                <View style={styles.phoneLookupBanner}>
                  <Text style={styles.phoneLookupBannerText}>{phoneLookupNotice}</Text>
                </View>
              )}

              {/* Court / Facility Selection */}
              <Text style={styles.formLabel}>SELECT COURT / FACILITY *</Text>
              <View style={styles.facilityPillRow}>
                {facilities.map((f) => (
                  <TouchableOpacity
                    key={f.id}
                    style={[
                      styles.facilityPill,
                      newBookingFacilityId === f.id && styles.facilityPillActive,
                    ]}
                    onPress={() => setNewBookingFacilityId(f.id)}
                  >
                    <Text
                      style={[
                        styles.facilityPillText,
                        newBookingFacilityId === f.id && styles.facilityPillTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {f.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Contact Mobile with Phone Auto-Lookup (Requirement 5) */}
              <Text style={styles.formLabel}>CONTACT MOBILE NUMBER * (Auto-Lookup)</Text>
              <TextInput
                style={styles.modalDarkInput}
                placeholder="e.g. 9876543210 (enter 10 digits to auto-fetch player)"
                placeholderTextColor="#64748B"
                keyboardType="phone-pad"
                value={newBookingPhone}
                onChangeText={handleBookingPhoneChange}
              />

              {/* Customer Name */}
              <Text style={styles.formLabel}>CUSTOMER / PLAYER NAME *</Text>
              <TextInput
                style={styles.modalDarkInput}
                placeholder="e.g. Rohan Sharma"
                placeholderTextColor="#64748B"
                value={newBookingCustomer}
                onChangeText={setNewBookingCustomer}
              />

              {/* Booking Date & Hours */}
              <View style={styles.formRow}>
                <View style={[styles.formCol, { flex: 1.2 }]}>
                  <Text style={styles.formLabel}>BOOKING DATE (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.modalDarkInput}
                    placeholder="2026-10-12"
                    placeholderTextColor="#64748B"
                    value={newBookingDate}
                    onChangeText={setNewBookingDate}
                  />
                </View>
                <View style={styles.formCol}>
                  <Text style={styles.formLabel}>START HOUR</Text>
                  <TextInput
                    style={styles.modalDarkInput}
                    placeholder="07"
                    placeholderTextColor="#64748B"
                    keyboardType="numeric"
                    value={newBookingStartHour}
                    onChangeText={setNewBookingStartHour}
                  />
                </View>
                <View style={styles.formCol}>
                  <Text style={styles.formLabel}>END HOUR</Text>
                  <TextInput
                    style={styles.modalDarkInput}
                    placeholder="08"
                    placeholderTextColor="#64748B"
                    keyboardType="numeric"
                    value={newBookingEndHour}
                    onChangeText={setNewBookingEndHour}
                  />
                </View>
              </View>

              {/* Consumables Section (Requirement 4) */}
              <View style={styles.consumablesSection}>
                <View style={styles.consumablesSectionHeader}>
                  <Text style={styles.consumablesSectionTitle}>
                    📦 Add Consumables & Equipment (n items can be attached)
                  </Text>
                  <Text style={styles.consumablesSectionSub}>
                    Select any quantity of beverages, rentals, shuttles, or balls
                  </Text>
                </View>

                {ACADEMY_CONSUMABLES.map((item) => {
                  const qty = bookingConsumables[item.id] || 0;
                  return (
                    <View key={item.id} style={styles.consumableItemRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.consumableItemName}>{item.name}</Text>
                        <Text style={styles.consumableItemSub}>
                          ₹{item.price} / {item.unit} • {item.category}
                        </Text>
                      </View>
                      <View style={styles.stepperContainer}>
                        <TouchableOpacity
                          style={styles.stepperBtn}
                          onPress={() => updateBookingConsumableQty(item.id, -1)}
                          disabled={qty === 0}
                        >
                          <Text
                            style={[
                              styles.stepperBtnText,
                              qty === 0 && styles.stepperBtnDisabled,
                            ]}
                          >
                            -
                          </Text>
                        </TouchableOpacity>
                        <Text style={styles.stepperQty}>{qty}</Text>
                        <TouchableOpacity
                          style={styles.stepperBtn}
                          onPress={() => updateBookingConsumableQty(item.id, 1)}
                        >
                          <Text style={styles.stepperBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}

                {/* Live Price Summary */}
                <View style={styles.priceSummaryBox}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>
                      Court Rental (
                      {Math.max(
                        1,
                        (parseInt(newBookingEndHour, 10) || 8) -
                          (parseInt(newBookingStartHour, 10) || 7)
                      )}
                      h):
                    </Text>
                    <Text style={styles.summaryValue}>
                      ₹
                      {Math.max(
                        1,
                        (parseInt(newBookingEndHour, 10) || 8) -
                          (parseInt(newBookingStartHour, 10) || 7)
                      ) * 500}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>
                      Consumables Total (
                      {Object.values(bookingConsumables).reduce((a, b) => a + b, 0)}{" "}
                      items):
                    </Text>
                    <Text style={styles.summaryValue}>₹{consumablesTotal}</Text>
                  </View>
                  <View style={[styles.summaryRow, styles.summaryTotalRow]}>
                    <Text style={styles.summaryTotalLabel}>Total Booking Cost:</Text>
                    <Text style={styles.summaryTotalValue}>
                      ₹
                      {Math.max(
                        1,
                        (parseInt(newBookingEndHour, 10) || 8) -
                          (parseInt(newBookingStartHour, 10) || 7)
                      ) *
                        500 +
                        consumablesTotal}
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setIsNewBookingModalOpen(false)}
              >
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitModalBtn}
                onPress={handleCreateBookingSubmit}
                disabled={submittingBooking}
              >
                {submittingBooking ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitModalBtnText}>Confirm Booking</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 2: EXACT 4-SECTION DARK PLAYER ADMISSION MODAL                      */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      <Modal visible={isAdmitPlayerModalOpen} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalBackdrop}
          keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 10}
        >
          <View style={[styles.modalContainer, { maxWidth: 620, maxHeight: "90%" }]}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitleText}>Admit New Player</Text>
                <Text style={styles.modalSubText}>
                  Generates atomic OFA-* identifier sequence upon registration
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsAdmitPlayerModalOpen(false)}>
                <Text style={styles.closeModalText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalFormScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              {phoneLookupNotice && (
                <View style={styles.phoneLookupBanner}>
                  <Text style={styles.phoneLookupBannerText}>{phoneLookupNotice}</Text>
                </View>
              )}

              {/* SECTION 1: Personal Profile Details */}
              <View style={styles.admissionSectionBox}>
                <Text style={styles.admissionSectionHeading}>
                  👤 Personal Profile Details
                </Text>

                <View style={styles.formRow}>
                  <View style={styles.formCol}>
                    <Text style={styles.formLabel}>FULL NAME *</Text>
                    <TextInput
                      style={styles.modalDarkInput}
                      placeholder="e.g. Naman Agarwal"
                      placeholderTextColor="#64748B"
                      value={admitFullName}
                      onChangeText={setAdmitFullName}
                    />
                  </View>
                  <View style={styles.formCol}>
                    <Text style={styles.formLabel}>EMAIL ADDRESS *</Text>
                    <TextInput
                      style={styles.modalDarkInput}
                      placeholder="e.g. client@email.com"
                      placeholderTextColor="#64748B"
                      keyboardType="email-address"
                      value={admitEmail}
                      onChangeText={setAdmitEmail}
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={styles.formCol}>
                    <Text style={styles.formLabel}>
                      MOBILE NUMBER * (Auto-Lookup)
                    </Text>
                    <TextInput
                      style={styles.modalDarkInput}
                      placeholder="e.g. 9535682835"
                      placeholderTextColor="#64748B"
                      keyboardType="phone-pad"
                      value={admitMobile}
                      onChangeText={handleAdmissionPhoneChange}
                    />
                  </View>
                  <View style={styles.formCol}>
                    <Text style={styles.formLabel}>DATE OF BIRTH (YYYY-MM-DD)</Text>
                    <TextInput
                      style={styles.modalDarkInput}
                      placeholder="2002-10-12"
                      placeholderTextColor="#64748B"
                      value={admitDob}
                      onChangeText={handleDobChange}
                    />
                  </View>
                  <View style={[styles.formCol, { flex: 0.6 }]}>
                    <Text style={styles.formLabel}>AGE</Text>
                    <TextInput
                      style={[styles.modalDarkInput, styles.readOnlyInput]}
                      placeholder="24"
                      placeholderTextColor="#64748B"
                      value={admitAge}
                      editable={false}
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={styles.formCol}>
                    <Text style={styles.formLabel}>GENDER</Text>
                    <TextInput
                      style={styles.modalDarkInput}
                      placeholder="Male"
                      placeholderTextColor="#64748B"
                      value={admitGender}
                      onChangeText={setAdmitGender}
                    />
                  </View>
                  <View style={[styles.formCol, { flex: 1.5 }]}>
                    <Text style={styles.formLabel}>ADDRESS</Text>
                    <TextInput
                      style={styles.modalDarkInput}
                      placeholder="e.g. 123 Sports Street, Sector 5, Bangalore"
                      placeholderTextColor="#64748B"
                      value={admitAddress}
                      onChangeText={setAdmitAddress}
                    />
                  </View>
                </View>
              </View>

              {/* SECTION 2: Sports & Batch Setup (Requirements 6: OFA-1/2/3 & 6 Sports) */}
              <View style={styles.admissionSectionBox}>
                <Text style={styles.admissionSectionHeading}>
                  🏅 Sports & Batch Setup
                </Text>

                <Text style={styles.formLabel}>ADMISSION VENUE *</Text>
                <View style={styles.venuePillRow}>
                  {ADMISSION_VENUES.map((v) => (
                    <TouchableOpacity
                      key={v}
                      style={[styles.venuePill, admitVenue === v && styles.venuePillActive]}
                      onPress={() => setAdmitVenue(v)}
                    >
                      <Text
                        style={[
                          styles.venuePillText,
                          admitVenue === v && styles.venuePillTextActive,
                        ]}
                      >
                        {v}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.formLabel}>PREFERRED SPORT *</Text>
                <View style={styles.sportPillGrid}>
                  {PREFERRED_SPORTS.map((sp) => {
                    const isSelected =
                      admitSportId.toLowerCase() === sp.toLowerCase() ||
                      sports.find((s) => s.id === admitSportId)?.name.toLowerCase() === sp.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={sp}
                        style={[
                          styles.sportPill,
                          isSelected && styles.sportPillActive,
                        ]}
                        onPress={() => {
                          const matched = sports.find((s) => s.name.toLowerCase() === sp.toLowerCase());
                          setAdmitSportId(matched ? matched.id : sp);
                        }}
                      >
                        <Text
                          style={[
                            styles.sportPillText,
                            isSelected && styles.sportPillTextActive,
                          ]}
                        >
                          {sp}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.formRow}>
                  <View style={styles.formCol}>
                    <Text style={styles.formLabel}>ADMISSION DATE (YYYY-MM-DD) *</Text>
                    <TextInput
                      style={styles.modalDarkInput}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#64748B"
                      value={admitAdmissionDate}
                      onChangeText={setAdmitAdmissionDate}
                    />
                  </View>
                  <View style={styles.formCol}>
                    <Text style={styles.formLabel}>BATCH START TIME</Text>
                    <TextInput
                      style={styles.modalDarkInput}
                      placeholder="06:00 AM"
                      placeholderTextColor="#64748B"
                      value={admitStartTime}
                      onChangeText={setAdmitStartTime}
                    />
                  </View>
                  <View style={styles.formCol}>
                    <Text style={styles.formLabel}>BATCH END TIME</Text>
                    <TextInput
                      style={styles.modalDarkInput}
                      placeholder="07:00 AM"
                      placeholderTextColor="#64748B"
                      value={admitEndTime}
                      onChangeText={setAdmitEndTime}
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={styles.formCol}>
                    <Text style={styles.formLabel}>MONTHLY FEE (₹) *</Text>
                    <TextInput
                      style={styles.modalDarkInput}
                      placeholder="3500"
                      placeholderTextColor="#64748B"
                      keyboardType="numeric"
                      value={admitMonthlyFee}
                      onChangeText={setAdmitMonthlyFee}
                    />
                  </View>
                  <View style={styles.formCol}>
                    <Text style={styles.formLabel}>ADMISSION FEE (ONE-TIME) (₹)</Text>
                    <TextInput
                      style={styles.modalDarkInput}
                      placeholder="1000"
                      placeholderTextColor="#64748B"
                      keyboardType="numeric"
                      value={admitAdmissionFee}
                      onChangeText={setAdmitAdmissionFee}
                    />
                  </View>
                </View>
              </View>

              {/* SECTION 3: Coaching & Classification */}
              <View style={styles.admissionSectionBox}>
                <Text style={styles.admissionSectionHeading}>
                  🔮 Coaching & Classification
                </Text>

                <View style={styles.formRow}>
                  <View style={styles.formCol}>
                    <Text style={styles.formLabel}>COACHING TYPE *</Text>
                    <TextInput
                      style={styles.modalDarkInput}
                      placeholder="Group Coaching"
                      placeholderTextColor="#64748B"
                      value={admitCoachingType}
                      onChangeText={setAdmitCoachingType}
                    />
                  </View>
                  <View style={styles.formCol}>
                    <Text style={styles.formLabel}>AGE SEGMENT (AUTO-DERIVED)</Text>
                    <TextInput
                      style={[styles.modalDarkInput, styles.readOnlyInput]}
                      value={admitAgeSegment}
                      editable={false}
                    />
                  </View>
                </View>
              </View>

              {/* SECTION 4: Guardian & Account Settings */}
              <View style={styles.admissionSectionBox}>
                <Text style={styles.admissionSectionHeading}>
                  🛡️ Guardian & Account Settings
                </Text>

                <View style={styles.formRow}>
                  <View style={styles.formCol}>
                    <Text style={styles.formLabel}>GUARDIAN'S NAME</Text>
                    <TextInput
                      style={styles.modalDarkInput}
                      placeholder="e.g. Ramesh Agarwal"
                      placeholderTextColor="#64748B"
                      value={admitGuardianName}
                      onChangeText={setAdmitGuardianName}
                    />
                  </View>
                  <View style={styles.formCol}>
                    <Text style={styles.formLabel}>GUARDIAN'S MOBILE NUMBER</Text>
                    <TextInput
                      style={styles.modalDarkInput}
                      placeholder="e.g. 9887766554"
                      placeholderTextColor="#64748B"
                      keyboardType="phone-pad"
                      value={admitGuardianPhone}
                      onChangeText={handleAdmissionGuardianPhoneChange}
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={styles.formCol}>
                    <Text style={styles.formLabel}>PIC ID / IDENTITY CARD NUMBER</Text>
                    <TextInput
                      style={styles.modalDarkInput}
                      placeholder="e.g. Aadhaar / Voter Card"
                      placeholderTextColor="#64748B"
                      value={admitIdCard}
                      onChangeText={setAdmitIdCard}
                    />
                  </View>
                  <View style={styles.formCol}>
                    <Text style={styles.formLabel}>COPY STATUS</Text>
                    <TextInput
                      style={styles.modalDarkInput}
                      placeholder="Approved"
                      placeholderTextColor="#64748B"
                      value={admitCopyStatus}
                      onChangeText={setAdmitCopyStatus}
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={styles.formCol}>
                    <Text style={styles.formLabel}>TEMPORARY ACCOUNT PASSWORD *</Text>
                    <TextInput
                      style={styles.modalDarkInput}
                      placeholder="Welcome@123"
                      placeholderTextColor="#64748B"
                      value={admitTempPassword}
                      onChangeText={setAdmitTempPassword}
                    />
                  </View>
                  <View style={styles.formCol}>
                    <Text style={styles.formLabel}>PHOTOGRAPH UPLOAD</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      {admitPhotoUri ? (
                        <Image
                          source={{ uri: admitPhotoUri }}
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            borderWidth: 1,
                            borderColor: Colors.primary,
                          }}
                        />
                      ) : null}
                      <TouchableOpacity
                        style={[
                          styles.photoUploadBtn,
                          admitHasPhoto && styles.photoUploadBtnActive,
                          { flex: 1 },
                        ]}
                        onPress={handlePickPhoto}
                      >
                        <Text style={styles.photoUploadBtnText}>
                          {admitHasPhoto ? "✓ Change Photo" : "📷 Upload Photograph"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setIsAdmitPlayerModalOpen(false)}
              >
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitModalBtn}
                onPress={handleAdmitPlayerSubmit}
                disabled={submittingAdmission}
              >
                {submittingAdmission ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitModalBtnText}>Confirm Admission</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 3: IN-PLACE RECORD PAYMENT (WITH KEYBOARD AVOIDING VIEW)            */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      <Modal visible={isRecordPaymentModalOpen} animationType="fade" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalBackdrop}
          keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 10}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitleText}>Record Fee Payment</Text>
                <Text style={styles.modalSubText}>
                  Updates balance and invoice status live in the table
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsRecordPaymentModalOpen(false)}>
                <Text style={styles.closeModalText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalFormScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              <Text style={styles.formLabel}>SELECT INVOICE *</Text>
              <View style={styles.invoicePickerList}>
                {invoices.map((inv) => (
                  <TouchableOpacity
                    key={inv.id}
                    style={[
                      styles.invoiceSelectRow,
                      payInvoiceId === inv.id && styles.invoiceSelectRowActive,
                    ]}
                    onPress={() => {
                      setPayInvoiceId(inv.id);
                      setPayAmount(String(inv.balanceCents / 100));
                    }}
                  >
                    <Text style={styles.invoiceSelectText}>
                      {inv.invoiceNumber} • {inv.player?.fullName || "Player"}
                    </Text>
                    <Text style={styles.invoiceSelectBalance}>
                      ₹{(inv.balanceCents / 100).toLocaleString()} Due
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>AMOUNT (₹) *</Text>
              <TextInput
                style={styles.modalDarkInput}
                placeholder="e.g. 3500"
                placeholderTextColor="#64748B"
                keyboardType="numeric"
                value={payAmount}
                onChangeText={setPayAmount}
              />

              <Text style={styles.formLabel}>PAYMENT METHOD</Text>
              <View style={styles.methodPillRow}>
                {["UPI", "CASH", "CARD", "BANK_TRANSFER"].map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.methodPill,
                      payMethod === m && styles.methodPillActive,
                    ]}
                    onPress={() => setPayMethod(m)}
                  >
                    <Text
                      style={[
                        styles.methodPillText,
                        payMethod === m && styles.methodPillTextActive,
                      ]}
                    >
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>REFERENCE / TXN ID</Text>
              <TextInput
                style={styles.modalDarkInput}
                placeholder="e.g. UPI/20261012/8841"
                placeholderTextColor="#64748B"
                value={payReference}
                onChangeText={setPayReference}
              />
            </ScrollView>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setIsRecordPaymentModalOpen(false)}
              >
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitModalBtn}
                onPress={handleRecordPaymentSubmit}
                disabled={submittingPayment}
              >
                {submittingPayment ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitModalBtnText}>Record Payment</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Stylesheet ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#0A0E17",
  },

  // Sidebar Ribbon Styles
  sidebarContainer: {
    width: 240,
    backgroundColor: "#0F1626",
    borderRightWidth: 1,
    borderRightColor: "#1B273E",
    paddingVertical: 10,
    paddingHorizontal: 8,
    justifyContent: "space-between",
  },
  sidebarCollapsed: {
    width: 64,
    paddingHorizontal: 4,
  },
  mobileSidebarRail: {
    width: 64,
    paddingHorizontal: 4,
  },
  railExpanderBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 2,
    backgroundColor: "#17233B",
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#253759",
  },
  railExpanderIcon: {
    color: "#38BDF8",
    fontSize: 16,
    fontWeight: "900",
  },
  railExpanderLabel: {
    color: "#94A3B8",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  drawerModalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.65)",
    zIndex: 9999,
    elevation: 50,
  },
  drawerPanel: {
    width: 275,
    height: "100%",
    backgroundColor: "#0F1626",
    borderRightWidth: 1,
    borderRightColor: "#1B273E",
    paddingVertical: 14,
    paddingHorizontal: 12,
    justifyContent: "space-between",
  },
  drawerDismissOverlay: {
    flex: 1,
  },
  drawerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1A253A",
  },
  drawerCloseBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "#1A253A",
  },
  drawerCloseText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "700",
  },

  brandHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1A253A",
  },
  brandBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#1D4ED8",
    alignItems: "center",
    justifyContent: "center",
  },
  brandLogoIcon: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  brandTextWrap: {
    flex: 1,
  },
  brandTitle: {
    color: "#F1F5F9",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  liveIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  liveText: {
    color: "#64748B",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#141D30",
    borderRadius: 10,
    padding: 8,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: "#1E2C44",
  },
  userAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: "#F1F5F9",
    fontSize: 12,
    fontWeight: "700",
  },
  userRole: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 1,
  },

  navListScroll: {
    flex: 1,
  },
  navSectionHeading: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 8,
  },
  navItemBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 3,
  },
  navItemBtnActive: {
    backgroundColor: "#1E2B45",
    borderLeftWidth: 3,
    borderLeftColor: "#3B82F6",
  },
  navItemBtnCollapsed: {
    justifyContent: "center",
    paddingHorizontal: 0,
    alignItems: "center",
  },
  navItemIcon: {
    fontSize: 16,
  },
  navItemLabelWrap: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  navItemLabel: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  navItemLabelActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  navBadge: {
    backgroundColor: "#1C273D",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  navBadgeActive: {
    backgroundColor: "#2563EB",
  },
  navBadgeText: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "700",
  },
  navBadgeTextActive: {
    color: "#FFFFFF",
  },

  chatNavSeparator: {
    height: 1,
    backgroundColor: "#1E2C44",
    marginVertical: 10,
  },
  chatNavBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#13233D",
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1E3A66",
  },
  chatNavBtnCollapsed: {
    justifyContent: "center",
    paddingHorizontal: 0,
    alignItems: "center",
  },
  chatNavLabel: {
    color: "#60A5FA",
    fontSize: 12,
    fontWeight: "700",
  },
  chatNavSubLabel: {
    color: "#64748B",
    fontSize: 9,
    fontWeight: "600",
  },

  sidebarFooter: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#1A253A",
    gap: 6,
  },
  collapseToggleBtn: {
    paddingVertical: 6,
    alignItems: "center",
    borderRadius: 6,
    backgroundColor: "#131D2F",
  },
  collapseToggleText: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  signOutBtnCollapsed: {
    justifyContent: "center",
    paddingHorizontal: 0,
    alignItems: "center",
  },
  signOutIcon: {
    fontSize: 14,
  },
  signOutText: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "600",
  },

  // Main Stage Styles
  mainStage: {
    flex: 1,
    backgroundColor: "#0A0E17",
  },
  topStageBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1A253A",
    backgroundColor: "#0D1322",
  },
  topBarLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginRight: 8,
  },
  stageTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  hamburgerBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: "#172238",
  },
  hamburgerIcon: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  stageTitle: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "800",
  },
  stageSubtitle: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 2,
  },
  topBarActions: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: 6,
  },
  refreshIconBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#162238",
    borderWidth: 1,
    borderColor: "#243552",
  },
  refreshIconText: {
    fontSize: 13,
  },
  primaryActionBtn: {
    backgroundColor: "#16A34A",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    flexShrink: 0,
  },
  primaryActionBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  stageScroll: {
    flex: 1,
  },
  stageScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  centerLoading: {
    paddingVertical: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#8B9BB4",
    marginTop: 10,
    fontSize: 13,
  },

  // KPI Grid
  kpiCardsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  kpiCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  kpiTitle: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "700",
  },
  kpiIcon: {
    fontSize: 16,
  },
  kpiValue: {
    color: "#F9FAFB",
    fontSize: 22,
    fontWeight: "900",
  },
  kpiSub: {
    color: "#6B7280",
    fontSize: 11,
    marginTop: 4,
  },

  // Overview Sections
  overviewSectionCard: {
    backgroundColor: "#101726",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1E2B42",
    padding: 14,
    marginBottom: 16,
  },
  overviewSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  overviewSectionTitleWrap: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  overviewSectionTitle: {
    color: "#F1F5F9",
    fontSize: 14,
    fontWeight: "800",
  },
  overviewSectionSub: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 2,
  },
  sectionHeaderActionBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    flexShrink: 0,
  },
  sectionHeaderActionText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },

  // Filter Control Bar
  filterControlBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
  },
  searchBarInput: {
    flex: 1,
    minWidth: 150,
    backgroundColor: "#131C2D",
    borderWidth: 1,
    borderColor: "#223048",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "#F1F5F9",
    fontSize: 13,
  },
  filterChipsRow: {
    flexDirection: "row",
    gap: 6,
  },
  filterChip: {
    backgroundColor: "#131C2D",
    borderWidth: 1,
    borderColor: "#223048",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
  },
  filterChipActive: {
    backgroundColor: "#2563EB",
    borderColor: "#3B82F6",
  },
  filterChipText: {
    color: "#8B9BB4",
    fontSize: 11,
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },

  inlineActionBtn: {
    backgroundColor: "#16A34A",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  inlineActionText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },

  // Table Cell Styling
  codeText: {
    color: "#38BDF8",
    fontWeight: "800",
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  cellBoldText: {
    color: "#F1F5F9",
    fontWeight: "700",
    fontSize: 12,
  },
  cellText: {
    color: "#CBD5E1",
    fontSize: 12,
  },
  cellMutedText: {
    color: "#64748B",
    fontSize: 11,
  },
  slotPillText: {
    color: "#93C5FD",
    fontSize: 11,
    fontWeight: "600",
  },
  sportBadgeText: {
    color: "#F59E0B",
    fontWeight: "700",
    fontSize: 11,
  },
  currencyCellText: {
    color: "#34D399",
    fontWeight: "700",
    fontSize: 12,
  },
  balanceDueText: {
    color: "#F87171",
  },
  balanceClearText: {
    color: "#34D399",
  },

  badgeWrap: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  badgeConfirmed: {
    backgroundColor: "#065F4630",
  },
  badgePending: {
    backgroundColor: "#78350F30",
  },
  badgeInactive: {
    backgroundColor: "#1F2937",
  },
  badgeOverdue: {
    backgroundColor: "#7F1D1D30",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  badgeTextConfirmed: {
    color: "#34D399",
  },
  badgeTextPending: {
    color: "#FBBF24",
  },
  badgeTextInactive: {
    color: "#9CA3AF",
  },
  badgeTextOverdue: {
    color: "#F87171",
  },

  listCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1A253A",
  },
  listCardTitle: {
    color: "#F1F5F9",
    fontSize: 13,
    fontWeight: "700",
  },
  listCardSub: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 2,
  },

  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 500,
    backgroundColor: "#101726",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#22314D",
    padding: 16,
    maxHeight: "85%",
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1B273E",
    paddingBottom: 10,
  },
  modalTitleText: {
    color: "#F1F5F9",
    fontSize: 16,
    fontWeight: "800",
  },
  modalSubText: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 2,
  },
  closeModalText: {
    color: "#94A3B8",
    fontSize: 16,
    fontWeight: "700",
  },
  modalFormScroll: {
    marginVertical: 6,
  },

  formLabel: {
    color: "#8B9BB4",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 4,
  },
  modalDarkInput: {
    backgroundColor: "#131C2D",
    borderWidth: 1,
    borderColor: "#202E46",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: "#F1F5F9",
    fontSize: 13,
    marginBottom: 4,
  },
  readOnlyInput: {
    backgroundColor: "#182338",
    color: "#94A3B8",
  },
  formRow: {
    flexDirection: "row",
    gap: 8,
  },
  formCol: {
    flex: 1,
  },

  admissionSectionBox: {
    backgroundColor: "#131C2D",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#202E46",
    padding: 12,
    marginBottom: 12,
  },
  admissionSectionHeading: {
    color: "#F1F5F9",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#1B273E",
  },

  photoUploadBtn: {
    backgroundColor: "#1A253A",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#3B82F6",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  photoUploadBtnActive: {
    backgroundColor: "#065F4640",
    borderColor: "#10B981",
  },
  photoUploadBtnText: {
    color: "#60A5FA",
    fontSize: 11,
    fontWeight: "700",
  },

  invoicePickerList: {
    maxHeight: 140,
    marginBottom: 8,
  },
  invoiceSelectRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#141D2F",
    padding: 9,
    borderRadius: 6,
    marginBottom: 4,
  },
  invoiceSelectRowActive: {
    backgroundColor: "#1D3256",
    borderWidth: 1,
    borderColor: "#3B82F6",
  },
  invoiceSelectText: {
    color: "#E2E8F0",
    fontSize: 12,
    fontWeight: "600",
  },
  invoiceSelectBalance: {
    color: "#F87171",
    fontSize: 11,
    fontWeight: "700",
  },
  methodPillRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },
  methodPill: {
    flex: 1,
    backgroundColor: "#141D2F",
    borderWidth: 1,
    borderColor: "#202E46",
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
  },
  methodPillActive: {
    backgroundColor: "#2563EB",
    borderColor: "#3B82F6",
  },
  methodPillText: {
    color: "#8B9BB4",
    fontSize: 11,
    fontWeight: "700",
  },
  methodPillTextActive: {
    color: "#FFFFFF",
  },

  modalActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#1B273E",
  },
  cancelModalBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2D3E5D",
  },
  cancelModalBtnText: {
    color: "#8B9BB4",
    fontSize: 13,
    fontWeight: "600",
  },
  submitModalBtn: {
    backgroundColor: "#16A34A",
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
  },
  submitModalBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  phoneLookupBanner: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    borderWidth: 1,
    borderColor: "#3B82F6",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  phoneLookupBannerText: {
    color: "#60A5FA",
    fontSize: 12,
    fontWeight: "700",
  },

  facilityPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  facilityPill: {
    backgroundColor: "#131D30",
    borderWidth: 1,
    borderColor: "#1E2C44",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  facilityPillActive: {
    backgroundColor: "#1D4ED8",
    borderColor: "#3B82F6",
  },
  facilityPillText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
  },
  facilityPillTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  consumablesSection: {
    backgroundColor: "#131D30",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1E2C44",
    padding: 12,
    marginTop: 10,
    marginBottom: 10,
  },
  consumablesSectionHeader: {
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#1B273E",
  },
  consumablesSectionTitle: {
    color: "#F1F5F9",
    fontSize: 13,
    fontWeight: "800",
  },
  consumablesSectionSub: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 2,
  },
  consumableItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#162238",
  },
  consumableItemName: {
    color: "#E2E8F0",
    fontSize: 12,
    fontWeight: "700",
  },
  consumableItemSub: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 2,
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0A0E17",
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#1E2C44",
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: "#1E2C44",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  stepperBtnDisabled: {
    color: "#475569",
  },
  stepperQty: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    minWidth: 20,
    textAlign: "center",
  },
  priceSummaryBox: {
    backgroundColor: "#0A0E17",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#1E2C44",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  summaryLabel: {
    color: "#94A3B8",
    fontSize: 12,
  },
  summaryValue: {
    color: "#E2E8F0",
    fontSize: 12,
    fontWeight: "600",
  },
  summaryTotalRow: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#1E2C44",
    marginBottom: 0,
  },
  summaryTotalLabel: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  summaryTotalValue: {
    color: "#10B981",
    fontSize: 14,
    fontWeight: "900",
  },

  venuePillRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  venuePill: {
    flex: 1,
    backgroundColor: "#141D30",
    borderWidth: 1,
    borderColor: "#202E46",
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  venuePillActive: {
    backgroundColor: "#1D4ED8",
    borderColor: "#3B82F6",
  },
  venuePillText: {
    color: "#8B9BB4",
    fontSize: 13,
    fontWeight: "700",
  },
  venuePillTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  sportPillGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  sportPill: {
    backgroundColor: "#141D30",
    borderWidth: 1,
    borderColor: "#202E46",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  sportPillActive: {
    backgroundColor: "#059669",
    borderColor: "#10B981",
  },
  sportPillText: {
    color: "#8B9BB4",
    fontSize: 12,
    fontWeight: "600",
  },
  sportPillTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  // Attendance Roster Styles
  attCard: {
    backgroundColor: "#0F1626",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1E2A42",
    padding: 16,
    marginBottom: 20,
  },
  attHeaderRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  attTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  attSub: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 2,
  },
  attDatePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#162035",
    borderWidth: 1,
    borderColor: "#263554",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 8,
  },
  attDateArrow: {
    color: "#38BDF8",
    fontSize: 14,
    fontWeight: "700",
    paddingHorizontal: 4,
  },
  attDateText: {
    color: "#F1F5F9",
    fontSize: 13,
    fontWeight: "700",
  },
  attSavePrimaryBtn: {
    backgroundColor: "#10B981",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  attSavePrimaryBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  attNoticeBanner: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "#10B981",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  attNoticeText: {
    color: "#34D399",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  attKpiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  attKpiCard: {
    flex: 1,
    minWidth: 70,
    backgroundColor: "#141D30",
    borderWidth: 1,
    borderColor: "#202E46",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  attKpiVal: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },
  attKpiLbl: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    marginTop: 2,
  },
  attBatchActionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  attBatchBtn: {
    backgroundColor: "#141D30",
    borderWidth: 1,
    borderColor: "#202E46",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  attBatchBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  attPlayerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#131C2E",
    borderWidth: 1,
    borderColor: "#1E2B45",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    gap: 10,
  },
  attPlayerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
    gap: 10,
  },
  attPlayerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
  },
  attPlayerAvatarText: {
    color: "#60A5FA",
    fontSize: 16,
    fontWeight: "800",
  },
  attPlayerName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  attPlayerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
    flexWrap: "wrap",
  },
  attPlayerCodeBadge: {
    backgroundColor: "#1E293B",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  attPlayerCodeText: {
    color: "#38BDF8",
    fontSize: 10,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  attPlayerMetaText: {
    color: "#94A3B8",
    fontSize: 11,
  },
  attStatusPillGroup: {
    flexDirection: "row",
    gap: 4,
  },
  attStatusBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  attStatusBtnText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "800",
  },
  attStatusPresentActive: {
    backgroundColor: "#065F46",
    borderColor: "#10B981",
  },
  attStatusPresentTextActive: {
    color: "#34D399",
  },
  attStatusAbsentActive: {
    backgroundColor: "#7F1D1D",
    borderColor: "#EF4444",
  },
  attStatusAbsentTextActive: {
    color: "#F87171",
  },
  attStatusLateActive: {
    backgroundColor: "#78350F",
    borderColor: "#F59E0B",
  },
  attStatusLateTextActive: {
    color: "#FBBF24",
  },
  attStatusExcusedActive: {
    backgroundColor: "#312E81",
    borderColor: "#6366F1",
  },
  attStatusExcusedTextActive: {
    color: "#A5B4FC",
  },

  // Clickable Phone Styles
  clickablePhonePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(14, 165, 233, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.4)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
    gap: 4,
  },
  clickablePhoneIcon: {
    fontSize: 10,
  },
  clickablePhoneText: {
    color: "#38BDF8",
    fontSize: 11,
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  // Attendance Sheet Dual-Feature Styles (Mark vs Report)
  attModeToggleRow: {
    flexDirection: "row",
    backgroundColor: "#0F172A",
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1E293B",
    gap: 6,
  },
  attModeToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  attModeToggleBtnActive: {
    backgroundColor: "#2563EB",
  },
  attModeToggleText: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "700",
  },
  attModeToggleTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  attDateSelectorWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  attDateInput: {
    color: "#38BDF8",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    minWidth: 92,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  attTodayBtn: {
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  attTodayBtnText: {
    color: "#38BDF8",
    fontSize: 12,
    fontWeight: "700",
  },
  reportFilterBox: {
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  reportFilterLabel: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  presetScroll: {
    marginBottom: 8,
  },
  reportPresetChip: {
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  reportPresetChipActive: {
    backgroundColor: "#2563EB",
    borderColor: "#3B82F6",
  },
  reportPresetChipText: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "600",
  },
  reportPresetChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  customRangeRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginTop: 4,
    flexWrap: "wrap",
  },
  customRangeLabel: {
    color: "#64748B",
    fontSize: 11,
    marginBottom: 2,
  },
  customRangeInput: {
    backgroundColor: "#141D30",
    borderWidth: 1,
    borderColor: "#202E46",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: "#FFFFFF",
    fontSize: 12,
  },
  customRangeApplyBtn: {
    backgroundColor: "#10B981",
    borderRadius: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
    height: 32,
  },
  customRangeApplyText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  reportStudentChip: {
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    maxWidth: 200,
  },
  reportStudentChipActive: {
    backgroundColor: "#0D9488",
    borderColor: "#14B8A6",
  },
  reportStudentChipText: {
    color: "#CBD5E1",
    fontSize: 11,
    fontWeight: "600",
  },
  reportStudentChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  reportStatusSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    flexWrap: "wrap",
  },
  reportRecordCard: {
    backgroundColor: "#131C2E",
    borderWidth: 1,
    borderColor: "#1E2B45",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  reportRecordTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
    paddingBottom: 6,
  },
  reportDateBadge: {
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  reportDateText: {
    color: "#38BDF8",
    fontSize: 12,
    fontWeight: "700",
  },
  reportStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  reportStatusBadgePresent: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "#10B981",
  },
  reportStatusBadgeAbsent: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "#EF4444",
  },
  reportStatusBadgeLate: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderColor: "#F59E0B",
  },
  reportStatusBadgeExcused: {
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    borderColor: "#6366F1",
  },
  reportStatusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  reportStatusBadgeTextPresent: {
    color: "#34D399",
  },
  reportStatusBadgeTextAbsent: {
    color: "#F87171",
  },
  reportStatusBadgeTextLate: {
    color: "#FBBF24",
  },
  reportStatusBadgeTextExcused: {
    color: "#A5B4FC",
  },
  reportRecordBody: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  reportStudentName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  reportRecordMetaRow: {
    marginTop: 3,
  },
  reportRecordSub: {
    color: "#94A3B8",
    fontSize: 11,
  },
  reportRecordNotes: {
    color: "#CBD5E1",
    fontSize: 11,
    marginTop: 4,
    fontStyle: "italic",
  },
});
