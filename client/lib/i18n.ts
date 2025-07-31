// Hệ thống i18n với tiếng Việt làm mặc định
type TranslationKey = 
  // Navigation
  | 'nav.submit_claim'
  | 'nav.track_claim' 
  | 'nav.advanced_search'
  | 'nav.dashboard'
  | 'nav.admin'
  | 'nav.profile'
  | 'nav.settings'
  | 'nav.support'
  | 'nav.logout'
  | 'nav.login'
  
  // Dashboard
  | 'dashboard.title'
  | 'dashboard.subtitle'
  | 'dashboard.filter'
  | 'dashboard.new_claim'
  | 'dashboard.total_claims'
  | 'dashboard.pending_review'
  | 'dashboard.processed_today'
  | 'dashboard.avg_processing_time'
  | 'dashboard.processing_performance'
  | 'dashboard.team_performance'
  | 'dashboard.recent_claims'
  | 'dashboard.search_placeholder'
  | 'dashboard.all_claims'
  | 'dashboard.pending'
  | 'dashboard.in_review'
  | 'dashboard.approved'
  | 'dashboard.claim_id'
  | 'dashboard.customer'
  | 'dashboard.type'
  | 'dashboard.amount'
  | 'dashboard.status'
  | 'dashboard.priority'
  | 'dashboard.assignee'
  | 'dashboard.days_open'
  | 'dashboard.actions'
  | 'dashboard.loading'
  | 'dashboard.top_performer'
  | 'dashboard.excellent'
  | 'dashboard.good'
  | 'dashboard.from_last_month'
  | 'dashboard.since_yesterday'
  | 'dashboard.vs_yesterday'
  | 'dashboard.improvement'
  | 'dashboard.auto_insurance'
  | 'dashboard.home_insurance'
  | 'dashboard.health_insurance'
  | 'dashboard.life_insurance'
  | 'dashboard.claims_count'
  | 'dashboard.days'
  
  // Claim Submission
  | 'claim.title'
  | 'claim.subtitle'
  | 'claim.basic_info'
  | 'claim.patient_info'
  | 'claim.medical_info'
  | 'claim.financial_info'
  | 'claim.documents'
  | 'claim.review'
  | 'claim.success_title'
  | 'claim.success_message'
  | 'claim.claim_id_label'
  | 'claim.view_claims'
  | 'claim.submit_new'
  | 'claim.back'
  | 'claim.next'
  | 'claim.save_draft'
  | 'claim.submit'
  | 'claim.step_of'
  
  // Common
  | 'common.loading'
  | 'common.error'
  | 'common.success'
  | 'common.submit'
  | 'common.cancel'
  | 'common.save'
  | 'common.edit'
  | 'common.delete'
  | 'common.view'
  | 'common.search'
  | 'common.filter'
  | 'common.all'
  | 'common.none'
  | 'common.yes'
  | 'common.no'
  | 'common.close'
  | 'common.open'
  | 'common.required'
  | 'common.optional'
  
  // Roles
  | 'role.admin'
  | 'role.claims_manager'
  | 'role.claim_executive'
  | 'role.hospital_staff'
  | 'role.customer'
  
  // Status
  | 'status.pending'
  | 'status.in_review'
  | 'status.approved'
  | 'status.rejected'
  | 'status.requires_info'
  | 'status.processing'
  | 'status.completed'
  | 'status.cancelled'
  
  // Priority
  | 'priority.high'
  | 'priority.medium'
  | 'priority.low'
  
  // Forms
  | 'form.required_field'
  | 'form.invalid_email'
  | 'form.password_too_short'
  | 'form.passwords_not_match'
  | 'form.field_required'
  | 'form.invalid_format'
  | 'form.save_success'
  | 'form.save_error';

// Bản dịch tiếng Việt (mặc định)
const vietnameseTranslations: Record<TranslationKey, string> = {
  // Navigation
  'nav.submit_claim': 'Nộp hồ sơ',
  'nav.track_claim': 'Tra cứu hồ sơ',
  'nav.advanced_search': 'Tìm kiếm nâng cao',
  'nav.dashboard': 'Bảng điều khiển',
  'nav.admin': 'Quản trị Admin',
  'nav.profile': 'Hồ sơ cá nhân',
  'nav.settings': 'Cài đặt',
  'nav.support': 'Hỗ trợ',
  'nav.logout': 'Đăng xuất',
  'nav.login': 'Đăng nhập',
  
  // Dashboard
  'dashboard.title': 'Bảng điều khiển yêu cầu bồi thường',
  'dashboard.subtitle': 'Theo dõi và quản lý tất cả hoạt động xử lý bồi thường',
  'dashboard.filter': 'Lọc',
  'dashboard.new_claim': 'Yêu cầu mới',
  'dashboard.total_claims': 'Tổng số yêu cầu',
  'dashboard.pending_review': 'Chờ xem xét',
  'dashboard.processed_today': 'Đã xử lý hôm nay',
  'dashboard.avg_processing_time': 'Thời gian xử lý TB',
  'dashboard.processing_performance': 'Hiệu suất xử lý',
  'dashboard.team_performance': 'Hiệu suất nhóm',
  'dashboard.recent_claims': 'Yêu cầu gần đây',
  'dashboard.search_placeholder': 'Tìm kiếm yêu cầu...',
  'dashboard.all_claims': 'Tất cả yêu cầu',
  'dashboard.pending': 'Chờ xử lý',
  'dashboard.in_review': 'Đang xem xét',
  'dashboard.approved': 'Đã duyệt',
  'dashboard.claim_id': 'Mã yêu cầu',
  'dashboard.customer': 'Khách hàng',
  'dashboard.type': 'Loại',
  'dashboard.amount': 'Số tiền',
  'dashboard.status': 'Trạng thái',
  'dashboard.priority': 'Ưu tiên',
  'dashboard.assignee': 'Người phụ trách',
  'dashboard.days_open': 'Số ngày mở',
  'dashboard.actions': 'Thao tác',
  'dashboard.loading': 'Đang tải bảng điều khiển...',
  'dashboard.top_performer': 'Xuất sắc nhất',
  'dashboard.excellent': 'Tuyệt vời',
  'dashboard.good': 'Tốt',
  'dashboard.from_last_month': 'so với tháng trước',
  'dashboard.since_yesterday': 'kể từ hôm qua',
  'dashboard.vs_yesterday': 'so với hôm qua',
  'dashboard.improvement': 'cải thiện',
  'dashboard.auto_insurance': 'Bảo hiểm xe cộ',
  'dashboard.home_insurance': 'Bảo hiểm nhà ở',
  'dashboard.health_insurance': 'Bảo hiểm y tế',
  'dashboard.life_insurance': 'Bảo hiểm nhân thọ',
  'dashboard.claims_count': 'yêu cầu',
  'dashboard.days': 'ngày',
  
  // Claim Submission
  'claim.title': 'Nộp hồ sơ bồi thường y tế',
  'claim.subtitle': 'Vui lòng điền đầy đủ thông tin để nộp yêu cầu bồi thường',
  'claim.basic_info': 'Thông tin cơ bản',
  'claim.patient_info': 'Thông tin bệnh nhân',
  'claim.medical_info': 'Thông tin y tế',
  'claim.financial_info': 'Thông tin tài chính',
  'claim.documents': 'Tài liệu',
  'claim.review': 'Xem lại',
  'claim.success_title': 'Nộp hồ sơ thành công!',
  'claim.success_message': 'Hồ sơ bồi thường của bạn đã được nộp thành công. Chúng tôi sẽ xử lý và thông báo kết quả trong thời gian sớm nhất.',
  'claim.claim_id_label': 'Mã hồ sơ',
  'claim.view_claims': 'Xem danh sách hồ sơ',
  'claim.submit_new': 'Nộp hồ sơ mới',
  'claim.back': 'Quay lại',
  'claim.next': 'Tiếp theo',
  'claim.save_draft': 'Lưu nháp',
  'claim.submit': 'Nộp hồ sơ',
  'claim.step_of': 'Bước',
  
  // Common
  'common.loading': 'Đang tải...',
  'common.error': 'Lỗi',
  'common.success': 'Thành công',
  'common.submit': 'Gửi',
  'common.cancel': 'Hủy',
  'common.save': 'Lưu',
  'common.edit': 'Sửa',
  'common.delete': 'Xóa',
  'common.view': 'Xem',
  'common.search': 'Tìm kiếm',
  'common.filter': 'Lọc',
  'common.all': 'Tất cả',
  'common.none': 'Không có',
  'common.yes': 'Có',
  'common.no': 'Không',
  'common.close': 'Đóng',
  'common.open': 'Mở',
  'common.required': 'Bắt buộc',
  'common.optional': 'Tùy chọn',
  
  // Roles
  'role.admin': 'Quản trị viên',
  'role.claims_manager': 'Quản lý bồi thường',
  'role.claim_executive': 'Nhân viên xử lý',
  'role.hospital_staff': 'Nhân viên bệnh viện',
  'role.customer': 'Khách hàng',
  
  // Status
  'status.pending': 'Chờ xử lý',
  'status.in_review': 'Đang xem xét',
  'status.approved': 'Đã duyệt',
  'status.rejected': 'Từ chối',
  'status.requires_info': 'Cần thông tin',
  'status.processing': 'Đang xử lý',
  'status.completed': 'Hoàn thành',
  'status.cancelled': 'Đã hủy',
  
  // Priority
  'priority.high': 'Cao',
  'priority.medium': 'Trung bình',
  'priority.low': 'Thấp',
  
  // Forms
  'form.required_field': 'Trường này là bắt buộc',
  'form.invalid_email': 'Email không hợp lệ',
  'form.password_too_short': 'Mật khẩu quá ngắn',
  'form.passwords_not_match': 'Mật khẩu không khớp',
  'form.field_required': 'Vui lòng điền thông tin này',
  'form.invalid_format': 'Định dạng không hợp lệ',
  'form.save_success': 'Lưu thành công',
  'form.save_error': 'Lỗi khi lưu',
};

// Hook để sử dụng bản dịch
export function useTranslation() {
  const t = (key: TranslationKey): string => {
    return vietnameseTranslations[key] || key;
  };

  return { t };
}

// Function để lấy bản dịch trực tiếp
export function t(key: TranslationKey): string {
  return vietnameseTranslations[key] || key;
}

// Export default translations
export const translations = vietnameseTranslations;
export default vietnameseTranslations;
