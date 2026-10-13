import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
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
  fetchAnnouncements,
  fetchAssessments,
  fetchBatches,
  fetchBookings,
  fetchFacilities,
  fetchInvoices,
  fetchPlayers,
  fetchSports,
  recordPayment,
  uploadPhoto,
  MOCK_PLAYERS,
  MOCK_BOOKINGS,
  MOCK_INVOICES,
  type AcademyAnnouncement,
  type AcademyAssessment,
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
  | "record_payment"
  | "consumables"
  | "attendance"
  | "sports"
  | "growth"
  | "announcements"
  | "submissions";

export function DashboardScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<RibbonTab>(
    (route.params?.initialTab as RibbonTab) || "overview"
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
  const [announcements, setAnnouncements] = useState<AcademyAnnouncement[]>([]);
  const [assessments, setAssessments] = useState<AcademyAssessment[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);

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
        aData,
        asData,
        dashData,
      ] = await Promise.all([
        fetchPlayers(),
        fetchSports(),
        fetchFacilities(),
        fetchBookings(),
        fetchInvoices(),
        fetchBatches(),
        fetchAnnouncements(),
        fetchAssessments(),
        getDashboardData({ tenantId: MOCK_CURRENT_USER.tenantId }).catch(() => null),
      ]);

      setPlayers((pData?.players && pData.players.length > 0) ? pData.players : MOCK_PLAYERS);
      setSports(sData || []);
      setFacilities(fData || []);
      setBookings((bData && bData.length > 0) ? bData : MOCK_BOOKINGS);
      setInvoices((iData && iData.length > 0) ? iData : MOCK_INVOICES);
      setBatches(btData || []);
      setAnnouncements(aData || []);
      setAssessments(asData || []);
      if (dashData?.data?.submissions) {
        setSubmissions(dashData.data.submissions);
      }

      if ((sData || []).length > 0 && !admitSportId) {
        setAdmitSportId(sData[0].id);
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

    const selectedSport = sports.find((s) => s.id === admitSportId);
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
        primarySportId: admitSportId,
        primarySportName: selectedSport?.name || "Selected Sport",
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
        label: "Booked By",
        width: 140,
        sortValue: (b) => b.bookedBy || "",
        renderCell: (b) => (
          <Text style={styles.cellText} numberOfLines={1}>
            {b.bookedBy || "Walk-in Guest"}
          </Text>
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
        width: 130,
        renderCell: (p) => (
          <Text style={styles.cellText}>
            {p.mobileNumber || p.guardianPhone || "—"}
          </Text>
        ),
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
        label: "Player Name",
        width: 160,
        sortValue: (i) => i.player?.fullName || "",
        renderCell: (i) => (
          <Text style={styles.cellBoldText} numberOfLines={1}>
            {i.player?.fullName || "Academy Player"}
          </Text>
        ),
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
    ],
    []
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
    const navItems = [
      { id: "overview", label: "Executive Hub", icon: "📊", badge: "Live" },
      { id: "bookings", label: "Courts & Bookings", icon: "📅", badge: String(bookings.length) },
      {
        id: "new_booking",
        label: "+ New Booking",
        icon: "➕",
        badge: "Form",
        isAction: () => setIsNewBookingModalOpen(true),
      },
      { id: "players", label: "Players Directory", icon: "👥", badge: String(players.length) },
      {
        id: "new_admission",
        label: "+ Admit Player",
        icon: "📝",
        badge: "Form",
        isAction: () => setIsAdmitPlayerModalOpen(true),
      },
      { id: "finance", label: "Fees & Invoices", icon: "💰", badge: String(invoices.length) },
      {
        id: "record_payment",
        label: "+ Pay Fee",
        icon: "💳",
        badge: "Form",
        isAction: () => setIsRecordPaymentModalOpen(true),
      },
      { id: "consumables", label: "Consumables Table", icon: "📦", badge: String(ACADEMY_CONSUMABLES.length) },
      { id: "attendance", label: "Attendance Sheet", icon: "⏱️", badge: `${batches.length} Batches` },
      { id: "sports", label: "Sports Master", icon: "🏅", badge: String(sports.length) },
      { id: "growth", label: "Growth & Skills", icon: "📈", badge: String(assessments.length) },
      { id: "announcements", label: "Announcements", icon: "📢", badge: String(announcements.length) },
    ];

    const isCollapsed = sidebarCollapsed || !isTablet;

    return (
      <View
        style={[
          styles.sidebarContainer,
          isCollapsed && styles.sidebarCollapsed,
          !isTablet && styles.mobileSidebarRail,
        ]}
      >
        {/* Brand & Organization Header */}
        <TouchableOpacity
          style={styles.brandHeader}
          onPress={() => setSidebarCollapsed(!sidebarCollapsed)}
          activeOpacity={0.8}
        >
          <View style={styles.brandBadge}>
            <Text style={styles.brandLogoIcon}>⚡</Text>
          </View>
          {!isCollapsed && (
            <View style={styles.brandTextWrap}>
              <Text style={styles.brandTitle}>OFA ACADEMY</Text>
              <View style={styles.liveIndicatorRow}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>OPERATIONS</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>

        {/* User Card */}
        {!isCollapsed && (
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
            {!isCollapsed ? "NAVIGATION TABS" : "•••"}
          </Text>

          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.navItemBtn,
                  isActive && styles.navItemBtnActive,
                  isCollapsed && styles.navItemBtnCollapsed,
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
                {!isCollapsed && (
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
            style={[styles.chatNavBtn, isCollapsed && styles.chatNavBtnCollapsed]}
            onPress={() =>
              navigation.navigate("Chat", {
                conversationId: "ofa-conv-001",
                conversationName: "OFA Assistant",
              })
            }
            activeOpacity={0.7}
          >
            <Text style={styles.navItemIcon}>💬</Text>
            {!isCollapsed && (
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
                {sidebarCollapsed ? "▶" : "◀ Collapse"}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.signOutBtn, isCollapsed && styles.signOutBtnCollapsed]}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutIcon}>🚪</Text>
            {!isCollapsed && <Text style={styles.signOutText}>Sign Out</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ─── Main Content View Render ───────────────────────────────────────────────

  return (
    <View style={[styles.screenContainer, { paddingTop: insets.top }]}>
      <RNStatusBar barStyle="light-content" backgroundColor="#0F1626" translucent={false} />
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
            >
              <Text style={styles.hamburgerIcon}>{sidebarCollapsed || !isTablet ? "▶" : "◀"}</Text>
            </TouchableOpacity>
            <View>
              <Text style={styles.stageTitle}>
                {activeTab === "overview" && "📊 Executive Operations Hub"}
                {activeTab === "bookings" && "📅 Courts & Facility Bookings"}
                {activeTab === "players" && "👥 Players Directory & Admissions"}
                {activeTab === "finance" && "💰 Fees, Payments & Invoices"}
                {activeTab === "consumables" && "📦 Consumables & Equipment Catalog"}
                {activeTab === "attendance" && "⏱️ Session Attendance Tracker"}
                {activeTab === "sports" && "🏅 Sports Disciplines & Batches"}
                {activeTab === "growth" && "📈 Player Growth & Assessments"}
                {activeTab === "announcements" && "📢 Academy Announcements"}
                {activeTab === "submissions" && "🤖 Bot Submissions Archive"}
              </Text>
              <Text style={styles.stageSubtitle}>
                Real-time operational dashboard with dynamic table column customization
              </Text>
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

            {activeTab === "bookings" && (
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={() => setIsNewBookingModalOpen(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryActionBtnText}>+ New Booking</Text>
              </TouchableOpacity>
            )}

            {activeTab === "players" && (
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={() => setIsAdmitPlayerModalOpen(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryActionBtnText}>+ Admit Player</Text>
              </TouchableOpacity>
            )}

            {activeTab === "finance" && (
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={() => setIsRecordPaymentModalOpen(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryActionBtnText}>+ Record Payment</Text>
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
                      <View>
                        <Text style={styles.overviewSectionTitle}>
                          📅 Latest Court & Facility Bookings
                        </Text>
                        <Text style={styles.overviewSectionSub}>
                          Live table of slot reservations
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.sectionHeaderActionBtn}
                        onPress={() => setIsNewBookingModalOpen(true)}
                      >
                        <Text style={styles.sectionHeaderActionText}>+ New Booking</Text>
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
                      <View>
                        <Text style={styles.overviewSectionTitle}>
                          👥 Recent Player Admissions
                        </Text>
                        <Text style={styles.overviewSectionSub}>
                          Latest player intake sequence records
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.sectionHeaderActionBtn}
                        onPress={() => setIsAdmitPlayerModalOpen(true)}
                      >
                        <Text style={styles.sectionHeaderActionText}>+ Admit Player</Text>
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
                        <Text style={styles.inlineActionText}>+ Add Booking</Text>
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
                        <Text style={styles.inlineActionText}>+ Admit Player</Text>
                      </TouchableOpacity>
                    }
                  />
                </View>
              )}

              {/* ── TAB 4: FEES & INVOICES ──────────────────────────────────────── */}
              {activeTab === "finance" && (
                <View>
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

                  {/* Flexible Table */}
                  <FlexibleDataTable
                    data={filteredInvoices}
                    columns={invoiceColumns}
                    keyExtractor={(i) => i.id}
                    emptyMessage="No invoices found matching current filters."
                    headerRight={
                      <TouchableOpacity
                        style={styles.inlineActionBtn}
                        onPress={() => setIsRecordPaymentModalOpen(true)}
                      >
                        <Text style={styles.inlineActionText}>+ Record Payment</Text>
                      </TouchableOpacity>
                    }
                  />
                </View>
              )}

              {/* ── TAB 5: ATTENDANCE ───────────────────────────────────────────── */}
              {activeTab === "attendance" && (
                <View style={styles.overviewSectionCard}>
                  <View style={styles.overviewSectionHeader}>
                    <View>
                      <Text style={styles.overviewSectionTitle}>
                        ⏱️ Active Training Batches & Rosters
                      </Text>
                      <Text style={styles.overviewSectionSub}>
                        Head coaches, schedules, and capacity limits
                      </Text>
                    </View>
                  </View>
                  {batches.map((batch) => (
                    <View key={batch.id} style={styles.listCardRow}>
                      <View>
                        <Text style={styles.listCardTitle}>{batch.name}</Text>
                        <Text style={styles.listCardSub}>
                          Sport: {batch.sport?.name || "General"} • Max Capacity: {batch.capacity}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.badgeWrap}
                        onPress={() => navigation.navigate("AcademyAttendance")}
                      >
                        <Text style={styles.badgeTextConfirmed}>Open Sheet →</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
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

              {/* ── TAB 7: GROWTH & SKILLS ───────────────────────────────────────── */}
              {activeTab === "growth" && (
                <View style={styles.overviewSectionCard}>
                  <View style={styles.overviewSectionHeader}>
                    <View>
                      <Text style={styles.overviewSectionTitle}>
                        📈 Player Growth & Skills Assessments
                      </Text>
                      <Text style={styles.overviewSectionSub}>
                        Skill radar scores and performance rubrics
                      </Text>
                    </View>
                  </View>
                  {assessments.map((ass) => (
                    <View key={ass.id} style={styles.listCardRow}>
                      <View>
                        <Text style={styles.listCardTitle}>{ass.playerName}</Text>
                        <Text style={styles.listCardSub}>
                          {ass.templateName} • Coach: {ass.conductedBy}
                        </Text>
                      </View>
                      <View style={styles.badgeWrap}>
                        <Text style={styles.badgeTextConfirmed}>{ass.scorePct}% Score</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* ── TAB 8: ANNOUNCEMENTS ─────────────────────────────────────────── */}
              {activeTab === "announcements" && (
                <View style={styles.overviewSectionCard}>
                  <View style={styles.overviewSectionHeader}>
                    <View>
                      <Text style={styles.overviewSectionTitle}>📢 Broadcast Notices</Text>
                      <Text style={styles.overviewSectionSub}>Academy announcements</Text>
                    </View>
                  </View>
                  {announcements.map((ann) => (
                    <View key={ann.id} style={styles.listCardRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.listCardTitle}>{ann.title}</Text>
                        <Text style={styles.listCardSub}>{ann.body}</Text>
                      </View>
                      <Text style={styles.cellMutedText}>{ann.createdAt.slice(0, 10)}</Text>
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
                      <View>
                        <Text style={styles.listCardTitle}>
                          {sub.userName || "Guest"} • /{sub.templateCommand}
                        </Text>
                        <Text style={styles.listCardSub}>
                          Ref: {sub.submissionRef || "N/A"} • Status: {sub.status}
                        </Text>
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
                    <View>
                      <Text style={styles.overviewSectionTitle}>
                        📦 Academy Consumables & Equipment Catalog
                      </Text>
                      <Text style={styles.overviewSectionSub}>
                        Inventory list of consumable items and rental gear with fixed rates
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.sectionHeaderActionBtn}
                      onPress={() => setIsNewBookingModalOpen(true)}
                    >
                      <Text style={styles.sectionHeaderActionText}>+ New Booking</Text>
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
                  {PREFERRED_SPORTS.map((sp) => (
                    <TouchableOpacity
                      key={sp}
                      style={[
                        styles.sportPill,
                        admitSportId === sp && styles.sportPillActive,
                      ]}
                      onPress={() => setAdmitSportId(sp)}
                    >
                      <Text
                        style={[
                          styles.sportPillText,
                          admitSportId === sp && styles.sportPillTextActive,
                        ]}
                      >
                        {sp}
                      </Text>
                    </TouchableOpacity>
                  ))}
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
    paddingVertical: 14,
    paddingHorizontal: 10,
    justifyContent: "space-between",
  },
  sidebarCollapsed: {
    width: 68,
    paddingHorizontal: 6,
  },
  mobileSidebarRail: {
    width: 68,
    paddingHorizontal: 4,
  },
  mobileSidebarDrawer: {
    width: 260,
    height: "100%",
  },
  mobileModalBackdrop: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  mobileBackdropDismiss: {
    flex: 1,
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
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1A253A",
    backgroundColor: "#0D1322",
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
    fontSize: 16,
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
    gap: 8,
  },
  refreshIconBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#162238",
    borderWidth: 1,
    borderColor: "#243552",
  },
  refreshIconText: {
    fontSize: 14,
  },
  primaryActionBtn: {
    backgroundColor: "#16A34A",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  primaryActionBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
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
    flexWrap: "wrap",
    gap: 8,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  sectionHeaderActionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  // Filter Control Bar
  filterControlBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  searchBarInput: {
    flex: 1,
    minWidth: 220,
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
});
