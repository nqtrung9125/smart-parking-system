using System.ComponentModel.DataAnnotations;

namespace Parking.Api.Contracts;

public sealed record CreateTopUpRequest(Guid RequestId, decimal Amount);

public sealed record ApproveTopUpRequest(decimal ReceivedAmount,
    [Required, StringLength(80)] string BankTransactionCode);
