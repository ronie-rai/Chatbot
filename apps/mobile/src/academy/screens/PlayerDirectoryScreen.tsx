import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { Colors, Fonts, Radius, Spacing } from "../../theme/tokens";
import {
  admitPlayer,
  fetchPlayers,
  fetchSports,
  uploadPhoto,
  type AcademyPlayer,
  type AcademySport,
} from "../api";

type Props = NativeStackScreenProps<RootStackParamList, "AcademyPlayers">;

export function PlayerDirectoryScreen({ route }: Props) {
  const [activeTab, setActiveTab] = useState<"players" | "sports">(
    route.params?.initialTab === "sports" ? "sports" : "players"
  );
  const [players, setPlayers] = useState<AcademyPlayer[]>([]);
  const [sports, setSports] = useState<AcademySport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modal State for Admission matching user specification
  const [isAdmitModalVisible, setIsAdmitModalVisible] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("2002-01-01");
  const [age, setAge] = useState("24");
  const [gender, setGender] = useState("Male");
  const [address, setAddress] = useState("");

  const [venue, setVenue] = useState<"OFA-1" | "OFA-2" | "OFA-3">("OFA-1");
  const [selectedSportId, setSelectedSportId] = useState("Football");
  const [admissionDate, setAdmissionDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [startTime, setStartTime] = useState("06:00 AM");
  const [endTime, setEndTime] = useState("07:00 AM");
  const [sessionsPerWeek, setSessionsPerWeek] = useState("Any / Not specified");
  const [monthlyFee, setMonthlyFee] = useState("3500");
  const [admissionFee, setAdmissionFee] = useState("1000");

  const [coachingType, setCoachingType] = useState("Group Coaching");
  const [ageSegment, setAgeSegment] = useState("Adults (19+)");
  const [trainingGroup, setTrainingGroup] = useState("-- Select group --");

  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [idCardNumber, setIdCardNumber] = useState("");
  const [copyStatus, setCopyStatus] = useState("Approved");
  const [temporaryPassword, setTemporaryPassword] = useState("Welcome@123");
  const [hasPhotograph, setHasPhotograph] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lookupBanner, setLookupBanner] = useState<string | null>(null);

  // Phone number auto-fill lookup
  const handleMobileChange = (text: string) => {
    setMobileNumber(text);
    const cleaned = text.replace(/\D/g, "");
    if (cleaned.length >= 10) {
      const match = players.find(
        (p) => (p.mobileNumber && p.mobileNumber.replace(/\D/g, "").includes(cleaned)) ||
               (p.guardianPhone && p.guardianPhone.replace(/\D/g, "").includes(cleaned))
      );
      if (match) {
        if (match.fullName) setFullName(match.fullName);
        if (match.email) setEmail(match.email);
        if (match.guardianName) setGuardianName(match.guardianName);
        if (match.guardianPhone) setGuardianPhone(match.guardianPhone);
        if (match.address) setAddress(match.address);
        if (match.gender) setGender(match.gender);
        if (match.dateOfBirth) handleDobChange(match.dateOfBirth);
        if (match.venue && (match.venue === "OFA-1" || match.venue === "OFA-2" || match.venue === "OFA-3")) {
          setVenue(match.venue);
        }
        setLookupBanner(`✨ Auto-filled profile from player record: ${match.fullName}`);
        setTimeout(() => setLookupBanner(null), 4000);
      }
    }
  };

  const handleGuardianPhoneChange = (text: string) => {
    setGuardianPhone(text);
    const cleaned = text.replace(/\D/g, "");
    if (cleaned.length >= 10 && !fullName) {
      const match = players.find(
        (p) => (p.guardianPhone && p.guardianPhone.replace(/\D/g, "").includes(cleaned)) ||
               (p.mobileNumber && p.mobileNumber.replace(/\D/g, "").includes(cleaned))
      );
      if (match) {
        if (match.fullName) setFullName(match.fullName);
        if (match.email) setEmail(match.email);
        if (match.guardianName) setGuardianName(match.guardianName);
        if (match.address) setAddress(match.address);
        setLookupBanner(`✨ Auto-filled profile from guardian: ${match.guardianName}`);
        setTimeout(() => setLookupBanner(null), 4000);
      }
    }
  };

  // Picker modal state
  const [pickerConfig, setPickerConfig] = useState<{
    title: string;
    options: { label: string; value: string }[];
    selectedValue: string;
    onSelect: (val: string) => void;
  } | null>(null);

  const handleDobChange = (text: string) => {
    setDateOfBirth(text);
    const yearMatch = text.match(/\b(19\d\d|20\d\d)\b/);
    if (yearMatch) {
      const birthYear = parseInt(yearMatch[1], 10);
      const currentYear = new Date().getFullYear();
      const calculatedAge = Math.max(0, currentYear - birthYear);
      setAge(String(calculatedAge));
      if (calculatedAge >= 19) setAgeSegment("Adults (19+)");
      else if (calculatedAge >= 16) setAgeSegment("Under-19 (U19)");
      else if (calculatedAge >= 14) setAgeSegment("Under-16 (U16)");
      else if (calculatedAge >= 12) setAgeSegment("Under-14 (U14)");
      else if (calculatedAge >= 10) setAgeSegment("Under-12 (U12)");
      else if (calculatedAge >= 8) setAgeSegment("Under-10 (U10)");
      else setAgeSegment("Under-8 (U8)");
    }
  };

  const resetForm = () => {
    setFullName("");
    setEmail("");
    setMobileNumber("");
    setDateOfBirth("2002-01-01");
    setAge("24");
    setGender("Male");
    setAddress("");
    setVenue("OFA-1");
    setSelectedSportId("Football");
    setAdmissionDate(new Date().toISOString().slice(0, 10));
    setStartTime("06:00 AM");
    setEndTime("07:00 AM");
    setSessionsPerWeek("Any / Not specified");
    setMonthlyFee("3500");
    setAdmissionFee("1000");
    setCoachingType("Group Coaching");
    setAgeSegment("Adults (19+)");
    setTrainingGroup("-- Select group --");
    setGuardianName("");
    setGuardianPhone("");
    setIdCardNumber("");
    setCopyStatus("Approved");
    setTemporaryPassword("Welcome@123");
    setHasPhotograph(false);
    setPhotoUri(null);
    setPhotoBase64(null);
    setLookupBanner(null);
  };

  const loadData = useCallback(async () => {
    try {
      const [pRes, sRes] = await Promise.all([
        fetchPlayers({ search: search.trim() || undefined }),
        fetchSports(),
      ]);
      setPlayers(pRes?.players || []);
      setSports(sRes || []);
      if ((sRes || []).length > 0) {
        const found = sRes.find(
          (s) =>
            s.id === selectedSportId ||
            s.name.toLowerCase() === selectedSportId.toLowerCase()
        );
        if (found) {
          setSelectedSportId(found.id);
        } else if (!selectedSportId) {
          setSelectedSportId(sRes[0].id);
        }
      }
    } catch {
      setPlayers([]);
      setSports([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, selectedSportId]);

  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadData();
  };

  const handleAdmit = async () => {
    if (!fullName.trim()) {
      Alert.alert("Missing Name", "Player full name is required.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }
    if (!mobileNumber.trim()) {
      Alert.alert("Missing Mobile", "Mobile number is required.");
      return;
    }
    if (!selectedSportId) {
      Alert.alert("Missing Sport", "Please select a preferred sport.");
      return;
    }
    if (!monthlyFee.trim() || isNaN(Number(monthlyFee))) {
      Alert.alert("Missing Monthly Fee", "Please enter a valid monthly fee amount.");
      return;
    }
    if (!temporaryPassword.trim()) {
      Alert.alert("Missing Password", "Temporary account password is required.");
      return;
    }

    setSubmitting(true);
    try {
      let uploadedPhotoUrl = photoUri || undefined;
      if (photoUri && photoBase64) {
        setUploadingPhoto(true);
        const upRes = await uploadPhoto({
          uri: photoUri,
          base64: photoBase64,
          name: `${fullName.replace(/\s+/g, "_") || "player"}_photo.jpg`,
        });
        if (upRes.ok && upRes.url) {
          uploadedPhotoUrl = upRes.url;
        }
        setUploadingPhoto(false);
      }

      const selectedSport = sports.find(
        (s) =>
          s.id === selectedSportId ||
          s.name.toLowerCase() === selectedSportId.toLowerCase()
      );
      const effectiveSportId = selectedSport?.id || selectedSportId;
      const effectiveSportName = selectedSport?.name || selectedSportId;
      const res = await admitPlayer({
        fullName: fullName.trim(),
        email: email.trim(),
        mobileNumber: mobileNumber.trim(),
        dateOfBirth: dateOfBirth.trim() || new Date().toISOString().slice(0, 10),
        age: parseInt(age, 10) || undefined,
        gender,
        address: address.trim() || undefined,

        venue,
        primarySportId: effectiveSportId,
        primarySportName: effectiveSportName,
        admissionDate,
        startTime,
        endTime,
        sessionsPerWeek,
        monthlyFee: parseFloat(monthlyFee) || 0,
        admissionFee: parseFloat(admissionFee) || 0,

        coachingType,
        ageSegment,
        trainingGroup,

        guardianName: guardianName.trim() || fullName.trim(),
        guardianPhone: guardianPhone.trim() || mobileNumber.trim(),
        idCardNumber: idCardNumber.trim() || undefined,
        copyStatus,
        temporaryPassword: temporaryPassword.trim(),
        photoUrl: uploadedPhotoUrl,
      });

      if (!res.ok || !res.player) {
        Alert.alert("Admission Failed", res.error || "Could not register player");
        return;
      }

      Alert.alert(
        "Admission Successful",
        `Assigned ID: ${res.player.playerCode}\nPlayer: ${res.player.fullName}\nSport: ${selectedSport?.name || "Sport"}`
      );
      setIsAdmitModalVisible(false);
      resetForm();
      void loadData();
    } catch {
      Alert.alert("Error", "Unexpected network error during admission");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = (players || []).filter((p) => {
    if (!p) return false;
    if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
    return true;
  });

  const renderPlayer = ({ item }: { item: AcademyPlayer }) => {
    const displayName = item.fullName || (item as any).name || "Academy Player";
    const initials = displayName.length >= 2 ? displayName.slice(0, 2).toUpperCase() : "AP";
    const sportName = item.primarySport?.name || "General Athletics";

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatar}>
            {item.photoUrl ? (
              <Image
                source={{ uri: item.photoUrl }}
                style={{ width: 44, height: 44, borderRadius: 22 }}
              />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </View>
          <View style={styles.playerMeta}>
            <View style={styles.nameRow}>
              <Text style={styles.playerName}>{displayName}</Text>
              <View style={styles.codeBadge}>
                <Text style={styles.codeText}>{item.playerCode}</Text>
              </View>
            </View>
            <Text style={styles.sportText}>
              ⚽ {sportName} • {item.gender || "Male"}
            </Text>
          </View>
          <View
            style={[
              styles.statusTag,
              item.status === "ACTIVE" ? styles.statusActive : styles.statusInactive,
            ]}
          >
            <Text style={styles.statusText}>{item.status || "ACTIVE"}</Text>
          </View>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardFooter}>
          <Text style={styles.guardianLabel}>
            Guardian: <Text style={styles.guardianValue}>{item.guardianName || "N/A"} ({item.guardianPhone || "N/A"})</Text>
          </Text>
          {item.medicalNotes ? (
            <Text style={styles.medNotes}>⚠️ {item.medicalNotes}</Text>
          ) : null}
        </View>
      </View>
    );
  };

  const renderSport = ({ item }: { item: AcademySport }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>🏅</Text>
        </View>
        <View style={styles.playerMeta}>
          <Text style={styles.playerName}>{item.name}</Text>
          <Text style={styles.sportText}>
            Billing: {(item.billingMethod || "MONTHLY_RECURRING").replace(/_/g, " ")} • {item.category || "SPORTS"}
          </Text>
        </View>
        <View
          style={[
            styles.statusTag,
            item.isActive ? styles.statusActive : styles.statusInactive,
          ]}
        >
          <Text style={styles.statusText}>{item.isActive ? "ACTIVE" : "INACTIVE"}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Top Main Mode Toggle */}
      <View style={styles.mainToggleBar}>
        <TouchableOpacity
          style={[styles.mainToggleBtn, activeTab === "players" && styles.mainToggleBtnActive]}
          onPress={() => setActiveTab("players")}
        >
          <Text style={[styles.mainToggleText, activeTab === "players" && styles.mainToggleTextActive]}>
            👥 Players Directory ({(players || []).length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mainToggleBtn, activeTab === "sports" && styles.mainToggleBtnActive]}
          onPress={() => setActiveTab("sports")}
        >
          <Text style={[styles.mainToggleText, activeTab === "sports" && styles.mainToggleTextActive]}>
            🏅 Sports Master ({(sports || []).length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "players" ? (
        <>
          {/* Search & Actions */}
          <View style={styles.topBar}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, ID (OFA-*), or phone..."
              placeholderTextColor={Colors.textSecondary}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => void loadData()}
            />
            <TouchableOpacity
              style={styles.admitBtn}
              onPress={() => setIsAdmitModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.admitBtnText}>+ Admit</Text>
            </TouchableOpacity>
          </View>

          {/* Filter Tabs */}
          <View style={styles.tabsRow}>
            {["ALL", "ACTIVE", "INACTIVE", "SUSPENDED"].map((st) => (
              <TouchableOpacity
                key={st}
                style={[styles.tabChip, statusFilter === st && styles.tabChipActive]}
                onPress={() => setStatusFilter(st)}
              >
                <Text
                  style={[
                    styles.tabChipText,
                    statusFilter === st && styles.tabChipTextActive,
                  ]}
                >
                  {st}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={Colors.primary} size="large" />
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              renderItem={renderPlayer}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyTitle}>No players found</Text>
                  <Text style={styles.emptySubtitle}>
                    Try adjusting your search criteria or register a new admission.
                  </Text>
                </View>
              }
            />
          )}
        </>
      ) : (
        /* Sports Master Tab */
        loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.primary} size="large" />
          </View>
        ) : (
          <FlatList
            data={sports || []}
            keyExtractor={(item) => item.id}
            renderItem={renderSport}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>No sports configured</Text>
                <Text style={styles.emptySubtitle}>
                  Configure academy disciplines in system settings.
                </Text>
              </View>
            }
          />
        )
      )}

      {/* Comprehensive Dark-Themed Admission Modal */}
      <Modal visible={isAdmitModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
          keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 10}
        >
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Admit New Player</Text>
                <Text style={styles.modalSubtitle}>
                  Generates an atomic OFA-* identifier sequence upon registration.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setIsAdmitModalVisible(false)}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {lookupBanner && (
                <View style={{ backgroundColor: "rgba(56,189,248,0.15)", borderWidth: 1, borderColor: "#38BDF8", borderRadius: 8, padding: 10, marginBottom: 12 }}>
                  <Text style={{ color: "#38BDF8", fontSize: 13, fontWeight: "600" }}>{lookupBanner}</Text>
                </View>
              )}

              {/* SECTION 1: Personal Profile Details */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionIcon}>👤</Text>
                  <Text style={[styles.sectionTitle, { color: "#38BDF8" }]}>
                    Personal Profile Details
                  </Text>
                </View>

                {/* Full Name & Email */}
                <View style={styles.gridRow}>
                  <View style={styles.gridCol}>
                    <Text style={styles.label}>
                      FULL NAME <Text style={styles.reqStar}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.darkInput}
                      placeholder="e.g. Naman Agarwal"
                      placeholderTextColor="#6E7681"
                      value={fullName}
                      onChangeText={setFullName}
                    />
                  </View>
                  <View style={styles.gridCol}>
                    <Text style={styles.label}>
                      EMAIL ADDRESS <Text style={styles.reqStar}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.darkInput}
                      placeholder="e.g. client@email.com"
                      placeholderTextColor="#6E7681"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={setEmail}
                    />
                  </View>
                </View>

                {/* Mobile, DOB, Age */}
                <View style={styles.gridRow}>
                  <View style={[styles.gridCol, { flex: 1.2 }]}>
                    <Text style={styles.label}>
                      MOBILE NUMBER <Text style={styles.reqStar}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.darkInput}
                      placeholder="e.g. 9535682835"
                      placeholderTextColor="#6E7681"
                      keyboardType="phone-pad"
                      value={mobileNumber}
                      onChangeText={handleMobileChange}
                    />
                  </View>
                  <View style={[styles.gridCol, { flex: 1.2 }]}>
                    <Text style={styles.label}>DATE OF BIRTH</Text>
                    <View style={styles.iconInputWrap}>
                      <TextInput
                        style={[styles.darkInput, { paddingRight: 32 }]}
                        placeholder="dd-----yyyy"
                        placeholderTextColor="#6E7681"
                        value={dateOfBirth}
                        onChangeText={handleDobChange}
                      />
                      <Text style={styles.inputInnerIcon}>📅</Text>
                    </View>
                  </View>
                  <View style={[styles.gridCol, { flex: 0.8 }]}>
                    <Text style={styles.label}>AGE</Text>
                    <TextInput
                      style={styles.darkInput}
                      placeholder="e.g. 24"
                      placeholderTextColor="#6E7681"
                      keyboardType="numeric"
                      value={age}
                      onChangeText={setAge}
                    />
                  </View>
                </View>

                {/* Gender & Address */}
                <View style={styles.gridRow}>
                  <View style={[styles.gridCol, { flex: 1 }]}>
                    <Text style={styles.label}>GENDER</Text>
                    <TouchableOpacity
                      style={styles.dropdownBtn}
                      onPress={() =>
                        setPickerConfig({
                          title: "Select Gender",
                          options: [
                            { label: "Male", value: "Male" },
                            { label: "Female", value: "Female" },
                            { label: "Other", value: "Other" },
                          ],
                          selectedValue: gender,
                          onSelect: (val) => setGender(val),
                        })
                      }
                    >
                      <Text style={styles.dropdownValue}>{gender}</Text>
                      <Text style={styles.dropdownChevron}>▼</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.gridCol, { flex: 2 }]}>
                    <Text style={styles.label}>ADDRESS</Text>
                    <TextInput
                      style={styles.darkInput}
                      placeholder="e.g. 123 Sports Street, Sector 5, Bangalore"
                      placeholderTextColor="#6E7681"
                      value={address}
                      onChangeText={setAddress}
                    />
                  </View>
                </View>
              </View>

              {/* SECTION 2: Sports & Batch Setup */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionIcon}>🏅</Text>
                  <Text style={[styles.sectionTitle, { color: "#34D399" }]}>
                    Sports & Batch Setup
                  </Text>
                </View>

                {/* Admission Venue & Preferred Sport */}
                <View style={styles.gridRow}>
                  <View style={styles.gridCol}>
                    <Text style={styles.label}>
                      ADMISSION VENUE <Text style={styles.reqStar}>*</Text>
                    </Text>
                    <TouchableOpacity
                      style={styles.dropdownBtn}
                      onPress={() =>
                        setPickerConfig({
                          title: "Select Admission Venue",
                          options: [
                            { label: "OFA-1", value: "OFA-1" },
                            { label: "OFA-2", value: "OFA-2" },
                            { label: "OFA-3", value: "OFA-3" },
                          ],
                          selectedValue: venue,
                          onSelect: (val) => setVenue(val as "OFA-1" | "OFA-2" | "OFA-3"),
                        })
                      }
                    >
                      <Text style={styles.dropdownValue} numberOfLines={1}>
                        {venue}
                      </Text>
                      <Text style={styles.dropdownChevron}>▼</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.gridCol}>
                    <Text style={styles.label}>
                      PREFERRED SPORT <Text style={styles.reqStar}>*</Text>
                    </Text>
                    <TouchableOpacity
                      style={styles.dropdownBtn}
                      onPress={() =>
                        setPickerConfig({
                          title: "Select Preferred Sport",
                          options: [
                            "Football",
                            "Cricket",
                            "Badminton",
                            "Tennis",
                            "Pickleball",
                            "Table Tennis",
                          ].map((s) => ({ label: s, value: s })),
                          selectedValue:
                            sports.find((s) => s.id === selectedSportId)?.name ||
                            selectedSportId,
                          onSelect: (val) => {
                            const matched = sports.find(
                              (s) => s.name.toLowerCase() === val.toLowerCase()
                            );
                            setSelectedSportId(matched ? matched.id : val);
                          },
                        })
                      }
                    >
                      <Text style={styles.dropdownValue} numberOfLines={1}>
                        {sports.find((s) => s.id === selectedSportId)?.name ||
                          selectedSportId}
                      </Text>
                      <Text style={styles.dropdownChevron}>▼</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Admission Date, Start Time, End Time */}
                <View style={styles.gridRow}>
                  <View style={[styles.gridCol, { flex: 1.2 }]}>
                    <Text style={styles.label}>
                      ADMISSION DATE <Text style={styles.reqStar}>*</Text>
                    </Text>
                    <View style={styles.iconInputWrap}>
                      <TextInput
                        style={[styles.darkInput, { paddingRight: 32 }]}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor="#6E7681"
                        value={admissionDate}
                        onChangeText={setAdmissionDate}
                      />
                      <Text style={styles.inputInnerIcon}>📅</Text>
                    </View>
                  </View>
                  <View style={[styles.gridCol, { flex: 1 }]}>
                    <Text style={styles.label}>BATCH START TIME</Text>
                    <TouchableOpacity
                      style={styles.dropdownBtn}
                      onPress={() =>
                        setPickerConfig({
                          title: "Select Batch Start Time",
                          options: ["06:00 AM", "07:00 AM", "08:00 AM", "09:00 AM", "04:00 PM", "05:00 PM", "06:00 PM", "07:00 PM"].map((t) => ({ label: t, value: t })),
                          selectedValue: startTime,
                          onSelect: (val) => setStartTime(val),
                        })
                      }
                    >
                      <Text style={styles.dropdownValue}>{startTime}</Text>
                      <Text style={styles.dropdownChevron}>▼</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.gridCol, { flex: 1 }]}>
                    <Text style={styles.label}>BATCH END TIME</Text>
                    <TouchableOpacity
                      style={styles.dropdownBtn}
                      onPress={() =>
                        setPickerConfig({
                          title: "Select Batch End Time",
                          options: ["07:00 AM", "08:00 AM", "09:00 AM", "10:00 AM", "05:00 PM", "06:00 PM", "07:00 PM", "08:00 PM"].map((t) => ({ label: t, value: t })),
                          selectedValue: endTime,
                          onSelect: (val) => setEndTime(val),
                        })
                      }
                    >
                      <Text style={styles.dropdownValue}>{endTime}</Text>
                      <Text style={styles.dropdownChevron}>▼</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Sessions / Week */}
                <View style={styles.gridRow}>
                  <View style={styles.gridCol}>
                    <Text style={styles.label}>SESSIONS / WEEK</Text>
                    <TouchableOpacity
                      style={styles.dropdownBtn}
                      onPress={() =>
                        setPickerConfig({
                          title: "Select Sessions / Week",
                          options: [
                            "Any / Not specified",
                            "1 Day / Week",
                            "2 Days / Week",
                            "3 Days / Week",
                            "4 Days / Week",
                            "5 Days / Week",
                            "6 Days / Week",
                            "Daily (7 Days / Week)",
                          ].map((s) => ({ label: s, value: s })),
                          selectedValue: sessionsPerWeek,
                          onSelect: (val) => setSessionsPerWeek(val),
                        })
                      }
                    >
                      <Text style={styles.dropdownValue}>{sessionsPerWeek}</Text>
                      <Text style={styles.dropdownChevron}>▼</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Monthly Fee & Admission Fee */}
                <View style={styles.gridRow}>
                  <View style={styles.gridCol}>
                    <Text style={styles.label}>
                      MONTHLY FEE <Text style={styles.reqStar}>*</Text>
                    </Text>
                    <View style={styles.currencyInputWrap}>
                      <Text style={styles.currencyPrefix}>₹</Text>
                      <TextInput
                        style={styles.currencyInput}
                        placeholder="e.g. 3500"
                        placeholderTextColor="#6E7681"
                        keyboardType="numeric"
                        value={monthlyFee}
                        onChangeText={setMonthlyFee}
                      />
                    </View>
                  </View>
                  <View style={styles.gridCol}>
                    <Text style={styles.label}>ADMISSION FEE (ONE-TIME)</Text>
                    <View style={styles.currencyInputWrap}>
                      <Text style={styles.currencyPrefix}>₹</Text>
                      <TextInput
                        style={styles.currencyInput}
                        placeholder="e.g. 1000"
                        placeholderTextColor="#6E7681"
                        keyboardType="numeric"
                        value={admissionFee}
                        onChangeText={setAdmissionFee}
                      />
                    </View>
                  </View>
                </View>
              </View>

              {/* SECTION 3: Coaching & Classification */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionIcon}>🔮</Text>
                  <Text style={[styles.sectionTitle, { color: "#A78BFA" }]}>
                    Coaching & Classification
                  </Text>
                </View>

                {/* Coaching Type & Age Segment */}
                <View style={styles.gridRow}>
                  <View style={styles.gridCol}>
                    <Text style={styles.label}>
                      COACHING TYPE <Text style={styles.reqStar}>*</Text>
                    </Text>
                    <TouchableOpacity
                      style={styles.dropdownBtn}
                      onPress={() =>
                        setPickerConfig({
                          title: "Select Coaching Type",
                          options: [
                            "Group Coaching",
                            "Personal / 1-on-1 Coaching",
                            "Weekend Academy",
                            "High Performance / Elite",
                            "Specialized Training",
                          ].map((c) => ({ label: c, value: c })),
                          selectedValue: coachingType,
                          onSelect: (val) => setCoachingType(val),
                        })
                      }
                    >
                      <Text style={styles.dropdownValue}>{coachingType}</Text>
                      <Text style={styles.dropdownChevron}>▼</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.gridCol}>
                    <Text style={styles.label}>
                      AGE SEGMENT <Text style={styles.subLabel}>(auto-derived from DOB)</Text>
                    </Text>
                    <TouchableOpacity
                      style={styles.dropdownBtn}
                      onPress={() =>
                        setPickerConfig({
                          title: "Select Age Segment",
                          options: [
                            "-- Select / Not set --",
                            "Under-8 (U8)",
                            "Under-10 (U10)",
                            "Under-12 (U12)",
                            "Under-14 (U14)",
                            "Under-16 (U16)",
                            "Under-19 (U19)",
                            "Adults (19+)",
                          ].map((a) => ({ label: a, value: a })),
                          selectedValue: ageSegment,
                          onSelect: (val) => setAgeSegment(val),
                        })
                      }
                    >
                      <Text style={styles.dropdownValue}>{ageSegment}</Text>
                      <Text style={styles.dropdownChevron}>▼</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Training Group */}
                <View style={styles.gridRow}>
                  <View style={styles.gridCol}>
                    <Text style={styles.label}>TRAINING GROUP</Text>
                    <TouchableOpacity
                      style={styles.dropdownBtn}
                      onPress={() =>
                        setPickerConfig({
                          title: "Select Training Group",
                          options: [
                            "-- Select group --",
                            "Beginner / Grassroots",
                            "Intermediate / Development",
                            "Advanced / Competitive",
                            "Elite Squad",
                            "Morning Batch A",
                            "Evening Batch B",
                          ].map((g) => ({ label: g, value: g })),
                          selectedValue: trainingGroup,
                          onSelect: (val) => setTrainingGroup(val),
                        })
                      }
                    >
                      <Text style={styles.dropdownValue}>{trainingGroup}</Text>
                      <Text style={styles.dropdownChevron}>▼</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* SECTION 4: Guardian & Account Settings */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionIcon}>🛡️</Text>
                  <Text style={[styles.sectionTitle, { color: "#FBBF24" }]}>
                    Guardian & Account Settings
                  </Text>
                </View>

                {/* Guardian Name & Phone */}
                <View style={styles.gridRow}>
                  <View style={styles.gridCol}>
                    <Text style={styles.label}>GUARDIAN'S NAME</Text>
                    <TextInput
                      style={styles.darkInput}
                      placeholder="e.g. Ramesh Agarwal"
                      placeholderTextColor="#6E7681"
                      value={guardianName}
                      onChangeText={setGuardianName}
                    />
                  </View>
                  <View style={styles.gridCol}>
                    <Text style={styles.label}>GUARDIAN'S MOBILE NUMBER</Text>
                    <TextInput
                      style={styles.darkInput}
                      placeholder="e.g. 9887766554"
                      placeholderTextColor="#6E7681"
                      keyboardType="phone-pad"
                      value={guardianPhone}
                      onChangeText={handleGuardianPhoneChange}
                    />
                  </View>
                </View>

                {/* ID Card Number & Copy Status */}
                <View style={styles.gridRow}>
                  <View style={styles.gridCol}>
                    <Text style={styles.label}>PIC ID / IDENTITY CARD NUMBER</Text>
                    <TextInput
                      style={styles.darkInput}
                      placeholder="e.g. Aadhaar / Voter Card"
                      placeholderTextColor="#6E7681"
                      value={idCardNumber}
                      onChangeText={setIdCardNumber}
                    />
                  </View>
                  <View style={styles.gridCol}>
                    <Text style={styles.label}>COPY STATUS</Text>
                    <TouchableOpacity
                      style={styles.dropdownBtn}
                      onPress={() =>
                        setPickerConfig({
                          title: "Select Copy Status",
                          options: [
                            "Approved",
                            "Pending Verification",
                            "Submitted",
                            "Not Submitted",
                          ].map((s) => ({ label: s, value: s })),
                          selectedValue: copyStatus,
                          onSelect: (val) => setCopyStatus(val),
                        })
                      }
                    >
                      <Text style={styles.dropdownValue}>{copyStatus}</Text>
                      <Text style={styles.dropdownChevron}>▼</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Password & Photo Upload */}
                <View style={styles.gridRow}>
                  <View style={styles.gridCol}>
                    <Text style={styles.label}>
                      TEMPORARY ACCOUNT PASSWORD <Text style={styles.reqStar}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.darkInput}
                      placeholder="Welcome@123"
                      placeholderTextColor="#6E7681"
                      secureTextEntry={false}
                      value={temporaryPassword}
                      onChangeText={setTemporaryPassword}
                    />
                  </View>
                  <View style={styles.gridCol}>
                    <Text style={styles.label}>PHOTOGRAPH UPLOAD</Text>
                    <View style={styles.photoUploadRow}>
                      <View style={styles.avatarPlaceholder}>
                        {photoUri ? (
                          <Image
                            source={{ uri: photoUri }}
                            style={{ width: 44, height: 44, borderRadius: 22 }}
                          />
                        ) : (
                          <Text style={{ fontSize: 20 }}>👤</Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.uploadBtn,
                          hasPhotograph && styles.uploadBtnActive,
                        ]}
                        onPress={async () => {
                          try {
                            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                            if (!perm.granted) {
                              Alert.alert(
                                "Permission Required",
                                "Please grant media library permission to choose a player photo."
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
                              setPhotoUri(asset.uri);
                              setPhotoBase64(asset.base64 || null);
                              setHasPhotograph(true);
                            }
                          } catch {
                            Alert.alert("Photo Error", "Could not select photo.");
                          }
                        }}
                      >
                        <Text style={styles.uploadBtnText}>
                          {hasPhotograph ? "✓ Change Photo" : "⬆ Choose / Take Photograph"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>

              {/* Bottom Actions */}
              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  style={styles.cancelActionBtn}
                  onPress={() => setIsAdmitModalVisible(false)}
                >
                  <Text style={styles.cancelActionText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.submitActionBtn}
                  onPress={handleAdmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.submitActionText}>Submit Admission</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Reusable Options Picker Modal */}
      <Modal visible={!!pickerConfig} animationType="fade" transparent>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerModalContent}>
            <Text style={styles.pickerTitle}>{pickerConfig?.title}</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {(pickerConfig?.options || []).map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.pickerOptionRow,
                    pickerConfig?.selectedValue === opt.value && styles.pickerOptionActive,
                  ]}
                  onPress={() => {
                    pickerConfig?.onSelect(opt.value);
                    setPickerConfig(null);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      pickerConfig?.selectedValue === opt.value && styles.pickerOptionTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {pickerConfig?.selectedValue === opt.value ? (
                    <Text style={styles.pickerCheckmark}>✓</Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.pickerCloseBtn}
              onPress={() => setPickerConfig(null)}
            >
              <Text style={styles.pickerCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screenBackground },
  mainToggleBar: {
    flexDirection: "row",
    backgroundColor: Colors.listBackground,
    padding: Spacing.sm,
    gap: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  mainToggleBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderRadius: Radius.md,
    backgroundColor: Colors.screenBackground,
  },
  mainToggleBtnActive: {
    backgroundColor: Colors.primary,
  },
  mainToggleText: {
    fontSize: Fonts.sizes.xs,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  mainToggleTextActive: {
    color: Colors.textLight,
  },
  topBar: {
    flexDirection: "row",
    padding: Spacing.md,
    backgroundColor: Colors.listBackground,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.screenBackground,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Fonts.sizes.md,
    color: Colors.textPrimary,
  },
  admitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  admitBtnText: { color: Colors.textLight, fontWeight: "700", fontSize: Fonts.sizes.md },
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.listBackground,
    gap: Spacing.sm,
  },
  tabChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.screenBackground,
  },
  tabChipActive: { backgroundColor: Colors.primaryLight },
  tabChipText: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, fontWeight: "600" },
  tabChipTextActive: { color: Colors.textLight },
  listContent: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  card: {
    backgroundColor: Colors.listBackground,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentLight,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: Colors.primary, fontWeight: "800", fontSize: Fonts.sizes.md },
  playerMeta: { flex: 1, marginLeft: Spacing.md },
  nameRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  playerName: { fontSize: Fonts.sizes.lg, fontWeight: "700", color: Colors.textPrimary },
  codeBadge: {
    backgroundColor: Colors.screenBackground,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  codeText: { fontSize: Fonts.sizes.xs, color: Colors.primary, fontWeight: "700" },
  sportText: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary, marginTop: 2 },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  statusActive: { backgroundColor: "#E6F4EA" },
  statusInactive: { backgroundColor: "#FCE8E6" },
  statusText: { fontSize: Fonts.sizes.xs, fontWeight: "700", color: Colors.textPrimary },
  cardDivider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  cardFooter: { gap: 4 },
  guardianLabel: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  guardianValue: { color: Colors.textPrimary, fontWeight: "600" },
  medNotes: { fontSize: Fonts.sizes.xs, color: "#D93025", fontStyle: "italic" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: { alignItems: "center", marginTop: Spacing.xxl, padding: Spacing.xl },
  emptyTitle: { fontSize: Fonts.sizes.lg, fontWeight: "700", color: Colors.textPrimary },
  emptySubtitle: { fontSize: Fonts.sizes.md, color: Colors.textSecondary, textAlign: "center", marginTop: Spacing.xs },

  // Dark modal container
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.md,
  },
  modalContainer: {
    backgroundColor: "#0D1117",
    borderRadius: 16,
    maxHeight: "94%",
    width: "100%",
    maxWidth: 680,
    borderWidth: 1,
    borderColor: "#30363D",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#21262D",
    backgroundColor: "#161B22",
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#F0F6FC" },
  modalSubtitle: { fontSize: 12, color: "#8B949E", marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#21262D",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnText: { color: "#8B949E", fontSize: 14, fontWeight: "700" },
  modalScroll: { flexGrow: 0 },
  modalScrollContent: { padding: 16, gap: 16 },

  // Section Card
  sectionCard: {
    backgroundColor: "#13171F",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#21262D",
    gap: 12,
  },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  sectionIcon: { fontSize: 16 },
  sectionTitle: { fontSize: 15, fontWeight: "700", letterSpacing: 0.3 },

  gridRow: { flexDirection: "row", gap: 12 },
  gridCol: { flex: 1 },
  label: { fontSize: 11, fontWeight: "700", color: "#8B949E", marginBottom: 6, letterSpacing: 0.5 },
  subLabel: { fontSize: 10, fontWeight: "400", color: "#6E7681" },
  reqStar: { color: "#F85149" },

  darkInput: {
    backgroundColor: "#0A0E14",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#F0F6FC",
    borderWidth: 1,
    borderColor: "#262C36",
  },
  iconInputWrap: { position: "relative", justifyContent: "center" },
  inputInnerIcon: { position: "absolute", right: 10, fontSize: 14 },

  dropdownBtn: {
    backgroundColor: "#0A0E14",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "#262C36",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dropdownValue: { fontSize: 13, color: "#F0F6FC", flex: 1 },
  dropdownChevron: { fontSize: 10, color: "#8B949E", marginLeft: 6 },

  currencyInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0A0E14",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#262C36",
    paddingHorizontal: 10,
  },
  currencyPrefix: { fontSize: 14, fontWeight: "700", color: "#8B949E", marginRight: 4 },
  currencyInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: "#F0F6FC" },

  photoUploadRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatarPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#161B22",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#30363D",
    justifyContent: "center",
    alignItems: "center",
  },
  uploadBtn: {
    flex: 1,
    backgroundColor: "#161B22",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#388BFD",
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  uploadBtnActive: { backgroundColor: "#0E4429", borderColor: "#34D399" },
  uploadBtnText: { color: "#58A6FF", fontSize: 12, fontWeight: "700" },

  modalActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  cancelActionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#30363D",
  },
  cancelActionText: { color: "#8B949E", fontWeight: "600", fontSize: 14 },
  submitActionBtn: {
    backgroundColor: "#238636",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  submitActionText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },

  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  pickerModalContent: {
    backgroundColor: "#161B22",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#30363D",
    width: "100%",
    maxWidth: 420,
    padding: 16,
  },
  pickerTitle: { fontSize: 16, fontWeight: "700", color: "#F0F6FC", marginBottom: 12 },
  pickerOptionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  pickerOptionActive: { backgroundColor: "#1F6FEB20" },
  pickerOptionText: { fontSize: 14, color: "#C9D1D9" },
  pickerOptionTextActive: { color: "#58A6FF", fontWeight: "700" },
  pickerCheckmark: { color: "#58A6FF", fontWeight: "800", fontSize: 16 },
  pickerCloseBtn: { marginTop: 12, alignItems: "center", paddingVertical: 10 },
  pickerCloseText: { color: "#8B949E", fontWeight: "600", fontSize: 14 },
});
