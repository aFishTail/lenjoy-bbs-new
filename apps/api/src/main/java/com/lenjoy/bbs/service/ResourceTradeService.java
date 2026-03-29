package com.lenjoy.bbs.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.lenjoy.bbs.domain.dto.CreateResourceAppealRequest;
import com.lenjoy.bbs.domain.dto.ResourceAppealResponse;
import com.lenjoy.bbs.domain.dto.ResourcePurchaseSummaryResponse;
import com.lenjoy.bbs.domain.dto.ReviewResourceAppealRequest;
import com.lenjoy.bbs.domain.entity.PostEntity;
import com.lenjoy.bbs.domain.entity.ResourceAppealEntity;
import com.lenjoy.bbs.domain.entity.ResourcePurchaseEntity;
import com.lenjoy.bbs.domain.entity.SiteMessageEntity;
import com.lenjoy.bbs.domain.entity.UserAccountEntity;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.mapper.PostMapper;
import com.lenjoy.bbs.mapper.ResourceAppealMapper;
import com.lenjoy.bbs.mapper.ResourcePurchaseMapper;
import com.lenjoy.bbs.mapper.UserAccountMapper;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ResourceTradeService {

    private static final String TYPE_RESOURCE = "RESOURCE";
    private static final String POST_STATUS_PUBLISHED = "PUBLISHED";

    private static final String PURCHASE_STATUS_PAID = "PAID";
    private static final String PURCHASE_STATUS_PARTIAL_REFUNDED = "PARTIAL_REFUNDED";
    private static final String PURCHASE_STATUS_REFUNDED = "REFUNDED";

    private static final String APPEAL_STATUS_PENDING = "PENDING";
    private static final String APPEAL_STATUS_APPROVED = "APPROVED";
    private static final String APPEAL_STATUS_REJECTED = "REJECTED";

    private final ResourcePurchaseMapper resourcePurchaseMapper;
    private final ResourceAppealMapper resourceAppealMapper;
    private final PostMapper postMapper;
    private final UserAccountMapper userAccountMapper;
    private final WalletService walletService;
    private final SiteMessageService siteMessageService;

    @Transactional
    public ResourcePurchaseEntity purchase(Long postId, Long buyerId) {
        PostEntity post = requirePost(postId);
        if (!TYPE_RESOURCE.equals(post.getPostType())) {
            throw new ApiException("POST_TYPE_INVALID", "仅资源帖支持购买", HttpStatus.BAD_REQUEST);
        }
        if (!POST_STATUS_PUBLISHED.equals(post.getStatus()) || Boolean.TRUE.equals(post.getDeleted())) {
            throw new ApiException("POST_STATUS_INVALID", "当前资源帖不可购买", HttpStatus.BAD_REQUEST);
        }
        if (post.getAuthorId().equals(buyerId)) {
            throw new ApiException("INVALID_OPERATION", "不可购买自己的资源帖", HttpStatus.BAD_REQUEST);
        }
        UserAccountEntity buyer = requireUser(buyerId);
        UserAccountEntity seller = requireUser(post.getAuthorId());

        ResourcePurchaseEntity existing = resourcePurchaseMapper.selectByPostIdAndBuyerId(postId, buyerId);
        if (existing != null) {
            throw new ApiException("RESOURCE_ALREADY_PURCHASED", "该资源已购买，无需重复支付", HttpStatus.BAD_REQUEST);
        }
        if (post.getPrice() == null || post.getPrice() <= 0) {
            throw new ApiException("PRICE_INVALID", "资源帖售价异常", HttpStatus.BAD_REQUEST);
        }

        String buyerBizKey = "resource:purchase:buyer:" + postId + ":" + buyerId;
        String sellerBizKey = "resource:purchase:seller:" + postId + ":" + buyerId;
        walletService.adjustAvailableCoins(
                buyerId,
                "EXPENSE",
                post.getPrice(),
                "RESOURCE_PURCHASE",
                buyerBizKey,
                "购买资源《" + post.getTitle() + "》",
                null);
        walletService.adjustAvailableCoins(
                post.getAuthorId(),
                "INCOME",
                post.getPrice(),
                "RESOURCE_SALE",
                sellerBizKey,
                "资源售出《" + post.getTitle() + "》",
                null);

        ResourcePurchaseEntity purchase = new ResourcePurchaseEntity();
        purchase.setPostId(postId);
        purchase.setBuyerId(buyerId);
        purchase.setSellerId(post.getAuthorId());
        purchase.setPrice(post.getPrice());
        purchase.setRefundedAmount(0);
        purchase.setStatus(PURCHASE_STATUS_PAID);
        purchase.setCreatedAt(LocalDateTime.now());
        purchase.setUpdatedAt(LocalDateTime.now());
        resourcePurchaseMapper.insert(purchase);

        notifyPurchaseSuccess(post, purchase, buyer, seller);
        return purchase;
    }

    public ResourcePurchaseEntity findPurchase(Long postId, Long buyerId) {
        if (buyerId == null) {
            return null;
        }
        return resourcePurchaseMapper.selectByPostIdAndBuyerId(postId, buyerId);
    }

    public ResourceAppealEntity findAppealByPurchaseId(Long purchaseId) {
        if (purchaseId == null) {
            return null;
        }
        return resourceAppealMapper.selectByPurchaseId(purchaseId);
    }

    public boolean canAccessHiddenContent(Long postId, Long userId) {
        ResourcePurchaseEntity purchase = findPurchase(postId, userId);
        return purchase != null && !PURCHASE_STATUS_REFUNDED.equals(purchase.getStatus());
    }

    public List<ResourcePurchaseSummaryResponse> listMyPurchases(Long buyerId) {
        requireUser(buyerId);
        List<ResourcePurchaseEntity> purchases = resourcePurchaseMapper
                .selectList(new LambdaQueryWrapper<ResourcePurchaseEntity>()
                        .eq(ResourcePurchaseEntity::getBuyerId, buyerId)
                        .orderByDesc(ResourcePurchaseEntity::getCreatedAt));
        return toPurchaseSummaries(purchases);
    }

    public List<ResourcePurchaseSummaryResponse> listMySales(Long sellerId) {
        requireUser(sellerId);
        List<ResourcePurchaseEntity> purchases = resourcePurchaseMapper
                .selectList(new LambdaQueryWrapper<ResourcePurchaseEntity>()
                        .eq(ResourcePurchaseEntity::getSellerId, sellerId)
                        .orderByDesc(ResourcePurchaseEntity::getCreatedAt));
        return toPurchaseSummaries(purchases);
    }

    @Transactional
    public ResourceAppealResponse createAppeal(Long purchaseId, Long buyerId, CreateResourceAppealRequest request) {
        ResourcePurchaseEntity purchase = requirePurchase(purchaseId);
        if (!purchase.getBuyerId().equals(buyerId)) {
            throw new ApiException("FORBIDDEN", "仅买家可发起申诉", HttpStatus.FORBIDDEN);
        }
        if (PURCHASE_STATUS_REFUNDED.equals(purchase.getStatus())) {
            throw new ApiException("APPEAL_NOT_ALLOWED", "该交易已全额退款，无需重复申诉", HttpStatus.BAD_REQUEST);
        }
        ResourceAppealEntity existing = resourceAppealMapper.selectByPurchaseId(purchaseId);
        if (existing != null) {
            throw new ApiException("APPEAL_EXISTS", "该交易已提交申诉，请等待处理", HttpStatus.BAD_REQUEST);
        }

        ResourceAppealEntity appeal = new ResourceAppealEntity();
        appeal.setPurchaseId(purchaseId);
        appeal.setPostId(purchase.getPostId());
        appeal.setBuyerId(purchase.getBuyerId());
        appeal.setSellerId(purchase.getSellerId());
        appeal.setReason(request.getReason().trim());
        appeal.setDetail(blankToNull(request.getDetail()));
        appeal.setStatus(APPEAL_STATUS_PENDING);
        appeal.setRequestedRefundAmount(purchase.getPrice() - safeInt(purchase.getRefundedAmount()));
        appeal.setResolvedRefundAmount(0);
        appeal.setCreatedAt(LocalDateTime.now());
        appeal.setUpdatedAt(LocalDateTime.now());
        resourceAppealMapper.insert(appeal);

        PostEntity post = requirePost(purchase.getPostId());
        UserAccountEntity buyer = requireUser(buyerId);
        UserAccountEntity seller = requireUser(purchase.getSellerId());
        notifyAppealSubmitted(post, purchase, appeal, buyer, seller);

        return toAppealResponse(appeal, purchase, post, buyer, seller);
    }

    public List<ResourceAppealResponse> listAdminAppeals(String status, String keyword) {
        LambdaQueryWrapper<ResourceAppealEntity> query = new LambdaQueryWrapper<ResourceAppealEntity>()
                .orderByDesc(ResourceAppealEntity::getCreatedAt);
        if (status != null && !status.isBlank()) {
            query.eq(ResourceAppealEntity::getStatus, normalizeAppealStatus(status));
        }
        List<ResourceAppealEntity> appeals = resourceAppealMapper.selectList(query);
        if (appeals.isEmpty()) {
            return List.of();
        }

        Map<Long, ResourcePurchaseEntity> purchaseById = loadPurchases(appeals.stream()
                .map(ResourceAppealEntity::getPurchaseId)
                .collect(Collectors.toSet()));
        Map<Long, PostEntity> postById = loadPosts(appeals.stream().map(ResourceAppealEntity::getPostId)
                .collect(Collectors.toSet()));
        Map<Long, UserAccountEntity> userById = loadUsers(appeals.stream()
                .flatMap(appeal -> java.util.stream.Stream.of(appeal.getBuyerId(), appeal.getSellerId(),
                        appeal.getResolvedBy()))
                .filter(id -> id != null)
                .collect(Collectors.toSet()));

        List<ResourceAppealResponse> responses = appeals.stream()
                .map(appeal -> {
                    ResourcePurchaseEntity purchase = purchaseById.get(appeal.getPurchaseId());
                    UserAccountEntity buyer = userById.get(appeal.getBuyerId());
                    UserAccountEntity seller = userById.get(appeal.getSellerId());
                    PostEntity post = postById.get(appeal.getPostId());
                    return toAppealResponse(appeal, purchase, post, buyer, seller);
                })
                .toList();

        if (keyword == null || keyword.isBlank()) {
            return responses;
        }
        String trimmed = keyword.trim();
        return responses.stream()
                .filter(response -> containsIgnoreCase(response.getPostTitle(), trimmed)
                        || containsIgnoreCase(response.getBuyerUsername(), trimmed)
                        || containsIgnoreCase(response.getSellerUsername(), trimmed)
                        || containsIgnoreCase(response.getReason(), trimmed))
                .toList();
    }

    @Transactional
    public ResourceAppealResponse reviewAppeal(Long appealId, Long adminUserId, ReviewResourceAppealRequest request) {
        requireUser(adminUserId);
        ResourceAppealEntity appeal = requireAppeal(appealId);
        if (!APPEAL_STATUS_PENDING.equals(appeal.getStatus())) {
            throw new ApiException("APPEAL_STATUS_INVALID", "该申诉已处理", HttpStatus.BAD_REQUEST);
        }

        ResourcePurchaseEntity purchase = requirePurchase(appeal.getPurchaseId());
        PostEntity post = requirePost(purchase.getPostId());
        UserAccountEntity buyer = requireUser(purchase.getBuyerId());
        UserAccountEntity seller = requireUser(purchase.getSellerId());

        String action = normalizeReviewAction(request.getAction());
        if ("REJECT".equals(action)) {
            appeal.setStatus(APPEAL_STATUS_REJECTED);
            appeal.setResolutionNote(blankToNull(request.getResolutionNote()));
            appeal.setResolvedBy(adminUserId);
            appeal.setResolvedAt(LocalDateTime.now());
            appeal.setUpdatedAt(LocalDateTime.now());
            resourceAppealMapper.updateById(appeal);
            notifyAppealRejected(post, purchase, appeal, buyer, seller);
            return toAppealResponse(appeal, purchase, post, buyer, seller);
        }

        int maxRefundAmount = purchase.getPrice() - safeInt(purchase.getRefundedAmount());
        int refundAmount = request.getRefundAmount() == null ? maxRefundAmount : request.getRefundAmount();
        if (refundAmount <= 0 || refundAmount > maxRefundAmount) {
            throw new ApiException("REFUND_AMOUNT_INVALID", "退款金额超出可退范围", HttpStatus.BAD_REQUEST);
        }

        String sellerBizKey = "resource:refund:seller:" + appealId;
        String buyerBizKey = "resource:refund:buyer:" + appealId;
        walletService.adjustAvailableCoins(
                seller.getId(),
                "EXPENSE",
                refundAmount,
                "RESOURCE_REFUND_OUT",
                sellerBizKey,
                "资源申诉退款《" + post.getTitle() + "》",
                adminUserId);
        walletService.adjustAvailableCoins(
                buyer.getId(),
                "INCOME",
                refundAmount,
                "RESOURCE_REFUND_IN",
                buyerBizKey,
                "资源申诉退款《" + post.getTitle() + "》",
                adminUserId);

        int nextRefundedAmount = safeInt(purchase.getRefundedAmount()) + refundAmount;
        purchase.setRefundedAmount(nextRefundedAmount);
        purchase.setStatus(nextRefundedAmount >= purchase.getPrice()
                ? PURCHASE_STATUS_REFUNDED
                : PURCHASE_STATUS_PARTIAL_REFUNDED);
        purchase.setRefundedAt(LocalDateTime.now());
        purchase.setUpdatedAt(LocalDateTime.now());
        resourcePurchaseMapper.updateById(purchase);

        appeal.setStatus(APPEAL_STATUS_APPROVED);
        appeal.setResolvedRefundAmount(refundAmount);
        appeal.setResolutionNote(blankToNull(request.getResolutionNote()));
        appeal.setResolvedBy(adminUserId);
        appeal.setResolvedAt(LocalDateTime.now());
        appeal.setUpdatedAt(LocalDateTime.now());
        resourceAppealMapper.updateById(appeal);

        notifyRefundApproved(post, purchase, appeal, buyer, seller, refundAmount);

        return toAppealResponse(appeal, purchase, post, buyer, seller);
    }

    private void notifyPurchaseSuccess(PostEntity post,
            ResourcePurchaseEntity purchase,
            UserAccountEntity buyer,
            UserAccountEntity seller) {
        siteMessageService.createMessage(
                buyer.getId(),
                SiteMessageService.MESSAGE_TYPE_RESOURCE_PURCHASED_BUYER,
                "购买成功",
                "你已成功购买资源《" + post.getTitle() + "》，现在可以查看隐藏内容。",
                purchase.getId(),
                post.getId(),
                purchase.getId(),
                null);
        siteMessageService.createMessage(
                seller.getId(),
                SiteMessageService.MESSAGE_TYPE_RESOURCE_PURCHASED_SELLER,
                "资源已售出",
                "用户 " + buyer.getUsername() + " 购买了你的资源《" + post.getTitle() + "》，金币已到账。",
                purchase.getId(),
                post.getId(),
                purchase.getId(),
                null);
    }

    private void notifyAppealSubmitted(PostEntity post,
            ResourcePurchaseEntity purchase,
            ResourceAppealEntity appeal,
            UserAccountEntity buyer,
            UserAccountEntity seller) {
        siteMessageService.createMessage(
                buyer.getId(),
                SiteMessageService.MESSAGE_TYPE_RESOURCE_APPEAL_SUBMITTED_BUYER,
                "申诉已提交",
                "你对资源《" + post.getTitle() + "》的申诉已提交，等待管理员处理。",
                appeal.getId(),
                post.getId(),
                purchase.getId(),
                appeal.getId());
        siteMessageService.createMessage(
                seller.getId(),
                SiteMessageService.MESSAGE_TYPE_RESOURCE_APPEAL_SUBMITTED_SELLER,
                "收到资源申诉",
                "用户 " + buyer.getUsername() + " 对资源《" + post.getTitle() + "》发起了申诉，请留意处理结果。",
                appeal.getId(),
                post.getId(),
                purchase.getId(),
                appeal.getId());
    }

    private void notifyAppealRejected(PostEntity post,
            ResourcePurchaseEntity purchase,
            ResourceAppealEntity appeal,
            UserAccountEntity buyer,
            UserAccountEntity seller) {
        String note = blankToNull(appeal.getResolutionNote());
        String buyerContent = note == null
                ? "你对资源《" + post.getTitle() + "》的申诉未通过，本次交易维持原状。"
                : "你对资源《" + post.getTitle() + "》的申诉未通过。处理说明：" + note;
        String sellerContent = note == null
                ? "资源《" + post.getTitle() + "》的申诉已被驳回，本次交易维持原状。"
                : "资源《" + post.getTitle() + "》的申诉已被驳回。处理说明：" + note;
        siteMessageService.createMessage(
                buyer.getId(),
                SiteMessageService.MESSAGE_TYPE_RESOURCE_REFUND_REJECTED_BUYER,
                "申诉未通过",
                buyerContent,
                appeal.getId(),
                post.getId(),
                purchase.getId(),
                appeal.getId());
        siteMessageService.createMessage(
                seller.getId(),
                SiteMessageService.MESSAGE_TYPE_RESOURCE_REFUND_REJECTED_SELLER,
                "申诉已驳回",
                sellerContent,
                appeal.getId(),
                post.getId(),
                purchase.getId(),
                appeal.getId());
    }

    private void notifyRefundApproved(PostEntity post,
            ResourcePurchaseEntity purchase,
            ResourceAppealEntity appeal,
            UserAccountEntity buyer,
            UserAccountEntity seller,
            int refundAmount) {
        String note = blankToNull(appeal.getResolutionNote());
        String buyerContent = "资源《" + post.getTitle() + "》的申诉已通过，已退回 " + refundAmount + " 金币。"
                + (note == null ? "" : " 处理说明：" + note);
        String sellerContent = "资源《" + post.getTitle() + "》的申诉已通过，已从你的钱包扣回 " + refundAmount + " 金币。"
                + (note == null ? "" : " 处理说明：" + note);
        siteMessageService.createMessage(
                buyer.getId(),
                SiteMessageService.MESSAGE_TYPE_RESOURCE_REFUND_APPROVED_BUYER,
                "退款已处理",
                buyerContent,
                appeal.getId(),
                post.getId(),
                purchase.getId(),
                appeal.getId());
        siteMessageService.createMessage(
                seller.getId(),
                SiteMessageService.MESSAGE_TYPE_RESOURCE_REFUND_APPROVED_SELLER,
                "退款已执行",
                sellerContent,
                appeal.getId(),
                post.getId(),
                purchase.getId(),
                appeal.getId());
    }

    private List<ResourcePurchaseSummaryResponse> toPurchaseSummaries(List<ResourcePurchaseEntity> purchases) {
        if (purchases.isEmpty()) {
            return List.of();
        }

        Map<Long, PostEntity> postById = loadPosts(purchases.stream().map(ResourcePurchaseEntity::getPostId)
                .collect(Collectors.toSet()));
        Set<Long> userIds = new LinkedHashSet<>();
        purchases.forEach(purchase -> {
            userIds.add(purchase.getBuyerId());
            userIds.add(purchase.getSellerId());
        });
        Map<Long, UserAccountEntity> userById = loadUsers(userIds);
        Map<Long, ResourceAppealEntity> appealByPurchaseId = loadAppeals(purchases.stream()
                .map(ResourcePurchaseEntity::getId)
                .collect(Collectors.toSet()));

        return purchases.stream().map(purchase -> {
            PostEntity post = postById.get(purchase.getPostId());
            UserAccountEntity buyer = userById.get(purchase.getBuyerId());
            UserAccountEntity seller = userById.get(purchase.getSellerId());
            ResourceAppealEntity appeal = appealByPurchaseId.get(purchase.getId());

            ResourcePurchaseSummaryResponse response = new ResourcePurchaseSummaryResponse();
            response.setPurchaseId(purchase.getId());
            response.setPostId(purchase.getPostId());
            response.setPostTitle(post == null ? null : post.getTitle());
            response.setBuyerId(purchase.getBuyerId());
            response.setBuyerUsername(buyer == null ? null : buyer.getUsername());
            response.setSellerId(purchase.getSellerId());
            response.setSellerUsername(seller == null ? null : seller.getUsername());
            response.setPrice(purchase.getPrice());
            response.setRefundedAmount(safeInt(purchase.getRefundedAmount()));
            response.setStatus(purchase.getStatus());
            response.setAppealStatus(appeal == null ? null : appeal.getStatus());
            response.setPurchasedAt(purchase.getCreatedAt());
            response.setUpdatedAt(purchase.getUpdatedAt());
            return response;
        }).toList();
    }

    private ResourceAppealResponse toAppealResponse(ResourceAppealEntity appeal,
            ResourcePurchaseEntity purchase,
            PostEntity post,
            UserAccountEntity buyer,
            UserAccountEntity seller) {
        ResourceAppealResponse response = new ResourceAppealResponse();
        response.setId(appeal.getId());
        response.setPurchaseId(appeal.getPurchaseId());
        response.setPostId(appeal.getPostId());
        response.setPostTitle(post == null ? null : post.getTitle());
        response.setReason(appeal.getReason());
        response.setDetail(appeal.getDetail());
        response.setStatus(appeal.getStatus());
        response.setRequestedRefundAmount(appeal.getRequestedRefundAmount());
        response.setResolvedRefundAmount(appeal.getResolvedRefundAmount());
        response.setResolutionNote(appeal.getResolutionNote());
        response.setBuyerId(appeal.getBuyerId());
        response.setBuyerUsername(buyer == null ? null : buyer.getUsername());
        response.setSellerId(appeal.getSellerId());
        response.setSellerUsername(seller == null ? null : seller.getUsername());
        response.setCreatedAt(appeal.getCreatedAt());
        response.setUpdatedAt(appeal.getUpdatedAt());
        if (response.getRequestedRefundAmount() == null && purchase != null) {
            response.setRequestedRefundAmount(purchase.getPrice() - safeInt(purchase.getRefundedAmount()));
        }
        return response;
    }

    private Map<Long, ResourcePurchaseEntity> loadPurchases(Set<Long> purchaseIds) {
        if (purchaseIds.isEmpty()) {
            return Map.of();
        }
        return resourcePurchaseMapper.selectList(new LambdaQueryWrapper<ResourcePurchaseEntity>()
                .in(ResourcePurchaseEntity::getId, purchaseIds)).stream()
                .collect(Collectors.toMap(ResourcePurchaseEntity::getId, Function.identity()));
    }

    private Map<Long, ResourceAppealEntity> loadAppeals(Set<Long> purchaseIds) {
        if (purchaseIds.isEmpty()) {
            return Map.of();
        }
        return resourceAppealMapper.selectList(new LambdaQueryWrapper<ResourceAppealEntity>()
                .in(ResourceAppealEntity::getPurchaseId, purchaseIds)).stream()
                .collect(Collectors.toMap(ResourceAppealEntity::getPurchaseId, Function.identity()));
    }

    private Map<Long, PostEntity> loadPosts(Set<Long> postIds) {
        if (postIds.isEmpty()) {
            return Map.of();
        }
        return postMapper.selectList(new LambdaQueryWrapper<PostEntity>()
                .in(PostEntity::getId, postIds)).stream()
                .collect(Collectors.toMap(PostEntity::getId, Function.identity()));
    }

    private Map<Long, UserAccountEntity> loadUsers(Set<Long> userIds) {
        if (userIds.isEmpty()) {
            return Map.of();
        }
        return userAccountMapper.selectList(new LambdaQueryWrapper<UserAccountEntity>()
                .in(UserAccountEntity::getId, userIds)).stream()
                .collect(Collectors.toMap(UserAccountEntity::getId, Function.identity()));
    }

    private ResourcePurchaseEntity requirePurchase(Long purchaseId) {
        ResourcePurchaseEntity purchase = resourcePurchaseMapper.selectById(purchaseId);
        if (purchase == null) {
            throw new ApiException("RESOURCE_PURCHASE_NOT_FOUND", "交易记录不存在", HttpStatus.NOT_FOUND);
        }
        return purchase;
    }

    private ResourceAppealEntity requireAppeal(Long appealId) {
        ResourceAppealEntity appeal = resourceAppealMapper.selectById(appealId);
        if (appeal == null) {
            throw new ApiException("RESOURCE_APPEAL_NOT_FOUND", "申诉记录不存在", HttpStatus.NOT_FOUND);
        }
        return appeal;
    }

    private PostEntity requirePost(Long postId) {
        PostEntity post = postMapper.selectById(postId);
        if (post == null) {
            throw new ApiException("POST_NOT_FOUND", "帖子不存在", HttpStatus.NOT_FOUND);
        }
        return post;
    }

    private UserAccountEntity requireUser(Long userId) {
        UserAccountEntity user = userAccountMapper.selectById(userId);
        if (user == null) {
            throw new ApiException("USER_NOT_FOUND", "用户不存在", HttpStatus.NOT_FOUND);
        }
        return user;
    }

    private String normalizeReviewAction(String action) {
        if (action == null || action.isBlank()) {
            throw new ApiException("REVIEW_ACTION_INVALID", "处理动作不合法", HttpStatus.BAD_REQUEST);
        }
        String normalized = action.trim().toUpperCase();
        if (!Set.of("APPROVE", "REJECT").contains(normalized)) {
            throw new ApiException("REVIEW_ACTION_INVALID", "处理动作不合法", HttpStatus.BAD_REQUEST);
        }
        return normalized;
    }

    private String normalizeAppealStatus(String status) {
        String normalized = status.trim().toUpperCase();
        if (!Set.of(APPEAL_STATUS_PENDING, APPEAL_STATUS_APPROVED, APPEAL_STATUS_REJECTED).contains(normalized)) {
            throw new ApiException("APPEAL_STATUS_INVALID", "申诉状态不合法", HttpStatus.BAD_REQUEST);
        }
        return normalized;
    }

    private boolean containsIgnoreCase(String value, String keyword) {
        return value != null && value.toLowerCase().contains(keyword.toLowerCase());
    }

    private String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private int safeInt(Integer value) {
        return value == null ? 0 : value;
    }
}